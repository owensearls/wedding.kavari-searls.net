import { describe, expect, it } from 'vitest'
import {
  guestRsvpSchema,
  lookupQuerySchema,
  rsvpStatusSchema,
  rsvpSubmissionSchema,
} from './rsvp'

describe('lookupQuerySchema', () => {
  it('accepts a normal query', () => {
    expect(lookupQuerySchema.parse({ query: 'alice' }).query).toBe('alice')
  })

  it('trims whitespace', () => {
    expect(lookupQuerySchema.parse({ query: '  alice  ' }).query).toBe('alice')
  })

  it('rejects empty string', () => {
    expect(() => lookupQuerySchema.parse({ query: '' })).toThrow()
    expect(() => lookupQuerySchema.parse({ query: '   ' })).toThrow()
  })

  it('rejects overly long queries', () => {
    expect(() => lookupQuerySchema.parse({ query: 'a'.repeat(500) })).toThrow()
  })

  it('rejects missing query key', () => {
    expect(() => lookupQuerySchema.parse({})).toThrow()
  })
})

describe('rsvpStatusSchema', () => {
  it('accepts the three known statuses', () => {
    expect(rsvpStatusSchema.parse('attending')).toBe('attending')
    expect(rsvpStatusSchema.parse('declined')).toBe('declined')
    expect(rsvpStatusSchema.parse('pending')).toBe('pending')
  })

  it('rejects unknown values', () => {
    expect(() => rsvpStatusSchema.parse('maybe')).toThrow()
  })
})

describe('guestRsvpSchema', () => {
  it('allows null mealChoiceId', () => {
    const r = guestRsvpSchema.parse({
      guestId: 'g1',
      eventId: 'e1',
      status: 'attending',
      mealChoiceId: null,
    })
    expect(r.mealChoiceId).toBeNull()
  })

  it('allows omitted mealChoiceId', () => {
    const r = guestRsvpSchema.parse({
      guestId: 'g1',
      eventId: 'e1',
      status: 'declined',
    })
    expect(r.mealChoiceId).toBeUndefined()
  })
})

describe('rsvpSubmissionSchema', () => {
  const minimal = {
    respondedByGuestId: 'g1',
    rsvps: [{ guestId: 'g1', eventId: 'e1', status: 'attending' }],
  }

  it('accepts a minimal payload and fills in defaults', () => {
    const parsed = rsvpSubmissionSchema.parse(minimal)
    expect(parsed.rsvps).toHaveLength(1)
    expect(parsed.guestUpdates).toEqual([])
  })

  it('accepts guest updates with notesJson', () => {
    const parsed = rsvpSubmissionSchema.parse({
      ...minimal,
      guestUpdates: [
        {
          guestId: 'g1',
          dietaryRestrictions: 'vegan',
          notesJson: {
            songRequest: { title: 'Wagon Wheel', artist: null },
          },
        },
      ],
    })
    expect(parsed.guestUpdates).toHaveLength(1)
    expect(parsed.guestUpdates[0].notesJson?.songRequest?.title).toBe(
      'Wagon Wheel'
    )
  })

  it('rejects missing respondedByGuestId', () => {
    expect(() =>
      rsvpSubmissionSchema.parse({
        rsvps: minimal.rsvps,
      })
    ).toThrow()
  })

  it('rejects unknown status values', () => {
    expect(() =>
      rsvpSubmissionSchema.parse({
        respondedByGuestId: 'g1',
        rsvps: [{ guestId: 'g1', eventId: 'e1', status: 'yes' }],
      })
    ).toThrow()
  })
})
