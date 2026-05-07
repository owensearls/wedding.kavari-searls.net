import { describe, expect, it } from 'vitest'
import {
  buildNotesValidator,
  fieldsInOrder,
  findOption,
  isShortTextField,
  isSingleSelectField,
  parseNotesSchema,
  stringifyNotesSchema,
  type NotesJsonSchema,
  type SingleSelectFieldSchema,
} from './notesSchema'

const schema: NotesJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  'x-fieldOrder': ['meal_choice', 'dietary_restrictions'],
  properties: {
    meal_choice: {
      title: 'Meal choice',
      oneOf: [
        { const: 'opt_chicken', title: 'Chicken', description: null },
        { const: 'opt_fish', title: 'Fish', description: null },
      ],
    },
    dietary_restrictions: {
      title: 'Dietary restrictions or allergies',
      type: 'string',
      maxLength: 500,
    },
  },
}

describe('parseNotesSchema', () => {
  it('returns null for null', () => {
    expect(parseNotesSchema(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseNotesSchema('')).toBeNull()
  })

  it('round-trips through stringify', () => {
    expect(parseNotesSchema(stringifyNotesSchema(schema))).toEqual(schema)
  })
})

describe('fieldsInOrder', () => {
  it('returns properties in x-fieldOrder', () => {
    const out = fieldsInOrder(schema)
    expect(out.map((f) => f.key)).toEqual([
      'meal_choice',
      'dietary_restrictions',
    ])
  })

  it('respects x-fieldOrder regardless of object key order', () => {
    const reordered: NotesJsonSchema = {
      ...schema,
      'x-fieldOrder': ['dietary_restrictions', 'meal_choice'],
    }
    expect(fieldsInOrder(reordered).map((f) => f.key)).toEqual([
      'dietary_restrictions',
      'meal_choice',
    ])
  })
})

describe('discriminators', () => {
  it('isShortTextField', () => {
    expect(isShortTextField(schema.properties.dietary_restrictions)).toBe(true)
    expect(isShortTextField(schema.properties.meal_choice)).toBe(false)
  })

  it('isSingleSelectField', () => {
    expect(isSingleSelectField(schema.properties.meal_choice)).toBe(true)
    expect(isSingleSelectField(schema.properties.dietary_restrictions)).toBe(
      false
    )
  })
})

describe('findOption', () => {
  it('returns the matching option', () => {
    const field = schema.properties.meal_choice as SingleSelectFieldSchema
    expect(findOption(field, 'opt_fish')?.title).toBe('Fish')
  })

  it('returns null when missing', () => {
    const field = schema.properties.meal_choice as SingleSelectFieldSchema
    expect(findOption(field, 'opt_nope')).toBeNull()
  })
})

describe('buildNotesValidator', () => {
  const v = buildNotesValidator(schema)

  it('accepts a valid short_text answer', () => {
    expect(v.safeParse({ dietary_restrictions: 'vegan' }).success).toBe(true)
  })

  it('rejects a short_text exceeding maxLength', () => {
    const r = v.safeParse({ dietary_restrictions: 'x'.repeat(501) })
    expect(r.success).toBe(false)
  })

  it('coerces empty short_text to null', () => {
    const r = v.safeParse({ dietary_restrictions: '   ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.dietary_restrictions).toBeNull()
  })

  it('accepts explicit null on short_text', () => {
    const r = v.safeParse({ dietary_restrictions: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.dietary_restrictions).toBeNull()
  })

  it('accepts explicit null on single_select', () => {
    const r = v.safeParse({ meal_choice: null })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.meal_choice).toBeNull()
  })

  it('accepts a known single_select option', () => {
    expect(v.safeParse({ meal_choice: 'opt_chicken' }).success).toBe(true)
  })

  it('rejects an unknown single_select option', () => {
    expect(v.safeParse({ meal_choice: 'opt_zzz' }).success).toBe(false)
  })

  it('coerces "" on single_select to null', () => {
    const r = v.safeParse({ meal_choice: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.meal_choice).toBeNull()
  })

  it('rejects unknown property keys', () => {
    expect(v.safeParse({ surprise: 'x' }).success).toBe(false)
  })

  it('accepts missing keys (every field is optional)', () => {
    expect(v.safeParse({}).success).toBe(true)
  })

  it('handles single-option single_select via z.literal', () => {
    const single: NotesJsonSchema = {
      type: 'object',
      additionalProperties: false,
      'x-fieldOrder': ['only'],
      properties: {
        only: {
          title: 'Only',
          oneOf: [{ const: 'opt_only', title: 'Only', description: null }],
        },
      },
    }
    const sv = buildNotesValidator(single)
    expect(sv.safeParse({ only: 'opt_only' }).success).toBe(true)
    expect(sv.safeParse({ only: 'opt_other' }).success).toBe(false)
  })
})
