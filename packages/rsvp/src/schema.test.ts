import { describe, expect, it } from 'vitest'
import {
  adminCustomFieldInputSchema,
  adminEventInputSchema,
  adminGroupInputSchema,
  adminGuestInputSchema,
  adminImportRowSchema,
  adminImportSchema,
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
  it('defaults customFields to empty array', () => {
    const r = adminEventInputSchema.parse({ name: 'Reception', slug: 'reception' })
    expect(r.customFields).toEqual([])
  })

  it('rejects non-snake-case event slugs', () => {
    expect(() =>
      adminEventInputSchema.parse({ name: 'Reception', slug: 'Reception_X' })
    ).toThrow()
  })
})

describe('adminCustomFieldInputSchema', () => {
  it('accepts a short_text field with no options', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'dietary_restrictions',
        label: 'Dietary',
        type: 'short_text',
      })
    ).not.toThrow()
  })

  it('rejects options on a short_text field', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'foo',
        label: 'Foo',
        type: 'short_text',
        options: [{ label: 'A' }],
      })
    ).toThrow()
  })

  it('rejects keys with uppercase or hyphens', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'Meal-Choice',
        label: 'Meal',
        type: 'single_select',
      })
    ).toThrow()
  })

  it('accepts single_select with options', () => {
    const r = adminCustomFieldInputSchema.parse({
      key: 'meal_choice',
      label: 'Meal',
      type: 'single_select',
      options: [{ label: 'Chicken' }, { label: 'Fish' }],
    })
    expect(r.options).toHaveLength(2)
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
