import { describe, expect, it } from 'vitest'
import {
  adminEventInputSchema,
  adminFieldDraftSchema,
  adminGroupInputSchema,
  adminGuestInputSchema,
  adminImportRowSchema,
  adminImportSchema,
  shortTextFieldSchema,
  singleSelectFieldSchema,
} from './schema'

describe('adminGuestInputSchema', () => {
  it('coerces blank email/phone/lastName to null', () => {
    const parsed = adminGuestInputSchema.parse({
      firstName: 'Alice',
      lastName: '',
      email: '',
      phone: '',
    })
    expect(parsed.email).toBeNull()
    expect(parsed.phone).toBeNull()
    expect(parsed.lastName).toBeNull()
  })

  it('rejects invalid emails', () => {
    expect(() =>
      adminGuestInputSchema.parse({ firstName: 'Alice', email: 'nope' })
    ).toThrow()
  })

  it('requires firstName', () => {
    expect(() => adminGuestInputSchema.parse({})).toThrow()
  })
})

describe('adminGroupInputSchema', () => {
  it('requires label when more than one guest', () => {
    expect(() =>
      adminGroupInputSchema.parse({
        guests: [{ firstName: 'A' }, { firstName: 'B' }],
      })
    ).toThrow()
  })

  it('allows blank label for single-guest invites', () => {
    const r = adminGroupInputSchema.parse({
      guests: [{ firstName: 'Solo' }],
    })
    expect(r.label).toBe('')
  })
})

describe('adminEventInputSchema', () => {
  it('defaults notesSchema to empty array', () => {
    const r = adminEventInputSchema.parse({
      name: 'Reception',
      slug: 'reception',
    })
    expect(r.notesSchema).toEqual([])
  })

  it('rejects non-snake-case event slugs', () => {
    expect(() =>
      adminEventInputSchema.parse({ name: 'Reception', slug: 'Reception_X' })
    ).toThrow()
  })

  it('rejects duplicate field keys', () => {
    expect(() =>
      adminEventInputSchema.parse({
        name: 'Reception',
        slug: 'reception',
        notesSchema: [
          {
            key: 'meal_choice',
            field: { title: 'Meal', type: 'string', maxLength: 500 },
          },
          {
            key: 'meal_choice',
            field: { title: 'Meal2', type: 'string', maxLength: 500 },
          },
        ],
      })
    ).toThrow()
  })
})

describe('adminFieldDraftSchema', () => {
  it('parses a short_text draft', () => {
    expect(() =>
      adminFieldDraftSchema.parse({
        key: 'dietary_restrictions',
        field: {
          title: 'Dietary',
          type: 'string',
          maxLength: 500,
        },
      })
    ).not.toThrow()
  })

  it('parses a single_select draft', () => {
    expect(() =>
      adminFieldDraftSchema.parse({
        key: 'meal_choice',
        field: {
          title: 'Meal',
          oneOf: [
            { const: 'opt_a', title: 'Chicken', description: '' },
            { const: 'opt_b', title: 'Fish', description: '' },
          ],
        },
      })
    ).not.toThrow()
  })

  it('rejects keys with uppercase or hyphens', () => {
    expect(() =>
      adminFieldDraftSchema.parse({
        key: 'Meal-Choice',
        field: {
          title: 'Meal',
          oneOf: [{ const: 'opt_a', title: 'Chicken', description: '' }],
        },
      })
    ).toThrow()
  })
})

describe('shortTextFieldSchema', () => {
  it('requires maxLength', () => {
    expect(() =>
      shortTextFieldSchema.parse({ title: 'Hi', type: 'string' })
    ).toThrow()
  })
})

describe('singleSelectFieldSchema', () => {
  it('rejects duplicate option const ids', () => {
    expect(() =>
      singleSelectFieldSchema.parse({
        title: 'Meal',
        oneOf: [
          { const: 'opt_a', title: 'Chicken', description: '' },
          { const: 'opt_a', title: 'Fish', description: '' },
        ],
      })
    ).toThrow()
  })

  it('rejects empty oneOf', () => {
    expect(() =>
      singleSelectFieldSchema.parse({ title: 'Meal', oneOf: [] })
    ).toThrow()
  })
})

describe('adminImportSchema', () => {
  it('rejects empty rows', () => {
    expect(() => adminImportSchema.parse({ rows: [] })).toThrow()
  })

  it('coerces blank optional cells', () => {
    const r = adminImportRowSchema.parse({
      groupLabel: 'Smiths',
      firstName: 'Alice',
      lastName: '',
      email: '',
      phone: '',
      events: '',
    })
    expect(r.lastName).toBeUndefined()
    expect(r.email).toBeUndefined()
  })
})
