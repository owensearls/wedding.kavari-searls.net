import { describe, expect, it } from 'vitest'
import {
  adminEventInputSchema,
  adminGroupInputSchema,
  adminGuestInputSchema,
  adminImportRowSchema,
  adminImportSchema,
} from './admin'

describe('adminGuestInputSchema', () => {
  it('coerces blank email/phone/dietary to null', () => {
    const parsed = adminGuestInputSchema.parse({
      firstName: 'Alice',
      lastName: '',
      email: '',
      phone: '',
      dietaryRestrictions: '   ',
      notes: '',
    })
    expect(parsed.email).toBeNull()
    expect(parsed.phone).toBeNull()
    expect(parsed.lastName).toBeNull()
    expect(parsed.dietaryRestrictions).toBeNull()
    expect(parsed.notes).toBeNull()
  })

  it('rejects invalid emails', () => {
    expect(() =>
      adminGuestInputSchema.parse({ firstName: 'Alice', email: 'not-an-email' }),
    ).toThrow()
  })

  it('requires firstName', () => {
    expect(() => adminGuestInputSchema.parse({ firstName: '' })).toThrow()
    expect(() => adminGuestInputSchema.parse({})).toThrow()
  })
})

describe('adminGroupInputSchema', () => {
  it('defaults invitedEventIds to empty array', () => {
    const parsed = adminGroupInputSchema.parse({
      label: 'The Smiths',
      guests: [{ firstName: 'Alice' }],
    })
    expect(parsed.invitedEventIds).toEqual([])
  })

  it('requires at least one guest', () => {
    expect(() =>
      adminGroupInputSchema.parse({ label: 'Empty', guests: [] }),
    ).toThrow()
  })

  it('requires a non-empty label', () => {
    expect(() =>
      adminGroupInputSchema.parse({
        label: '',
        guests: [{ firstName: 'Alice' }],
      }),
    ).toThrow()
  })
})

describe('adminImportRowSchema', () => {
  it('accepts a full row', () => {
    const parsed = adminImportRowSchema.parse({
      groupLabel: 'Smiths',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '+1 555 1234',
      events: 'ceremony,reception',
    })
    expect(parsed.firstName).toBe('Alice')
    expect(parsed.events).toBe('ceremony,reception')
  })

  it('coerces blank optional cells to undefined', () => {
    // This mirrors what papaparse produces for blank cells under header:true.
    const parsed = adminImportRowSchema.parse({
      groupLabel: 'Smiths',
      firstName: 'Alice',
      lastName: '',
      email: '',
      phone: '',
      events: '',
    })
    expect(parsed.lastName).toBeUndefined()
    expect(parsed.email).toBeUndefined()
    expect(parsed.phone).toBeUndefined()
    expect(parsed.events).toBeUndefined()
  })

  it('rejects rows missing firstName or groupLabel', () => {
    expect(() =>
      adminImportRowSchema.parse({ groupLabel: '', firstName: 'Alice' }),
    ).toThrow()
    expect(() =>
      adminImportRowSchema.parse({ groupLabel: 'Smiths', firstName: '' }),
    ).toThrow()
  })
})

describe('adminImportSchema', () => {
  it('requires at least one row', () => {
    expect(() => adminImportSchema.parse({ rows: [] })).toThrow()
  })

  it('caps the number of rows at 2000', () => {
    const row = { groupLabel: 'g', firstName: 'f' }
    expect(() =>
      adminImportSchema.parse({ rows: Array.from({ length: 2001 }, () => row) }),
    ).toThrow()
  })
})

describe('adminEventInputSchema', () => {
  it('validates slug is url-safe', () => {
    expect(() =>
      adminEventInputSchema.parse({ name: 'X', slug: 'Not A Slug!' }),
    ).toThrow()
    const ok = adminEventInputSchema.parse({ name: 'X', slug: 'ok-slug-1' })
    expect(ok.slug).toBe('ok-slug-1')
  })

  it('defaults mealOptions/requiresMealChoice/sortOrder', () => {
    const parsed = adminEventInputSchema.parse({ name: 'X', slug: 'x' })
    expect(parsed.mealOptions).toEqual([])
    expect(parsed.requiresMealChoice).toBe(false)
    expect(parsed.sortOrder).toBe(0)
  })

  it('coerces blank date/location fields to null', () => {
    const parsed = adminEventInputSchema.parse({
      name: 'X',
      slug: 'x',
      startsAt: '',
      endsAt: '',
      locationName: '',
      address: '',
      rsvpDeadline: '',
    })
    expect(parsed.startsAt).toBeNull()
    expect(parsed.endsAt).toBeNull()
    expect(parsed.locationName).toBeNull()
    expect(parsed.address).toBeNull()
    expect(parsed.rsvpDeadline).toBeNull()
  })

  it('accepts meal options with defaults', () => {
    const parsed = adminEventInputSchema.parse({
      name: 'Reception',
      slug: 'reception',
      mealOptions: [
        { label: 'Chicken' },
        { label: 'Veggie', description: 'Roasted seasonal veg' },
      ],
    })
    expect(parsed.mealOptions).toHaveLength(2)
    expect(parsed.mealOptions[0].label).toBe('Chicken')
    expect(parsed.mealOptions[0].description).toBeUndefined()
    expect(parsed.mealOptions[1].description).toBe('Roasted seasonal veg')
  })

  it('rejects meal options without a label', () => {
    expect(() =>
      adminEventInputSchema.parse({
        name: 'Reception',
        slug: 'reception',
        mealOptions: [{ label: '' }],
      }),
    ).toThrow()
  })
})
