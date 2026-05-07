import { describe, expect, it } from 'vitest'
import { canonicalNotesJson, diffGuestResponse, diffRsvpResponse } from './diff'

describe('canonicalNotesJson', () => {
  it('sorts keys deterministically and stringifies', () => {
    expect(canonicalNotesJson({ b: '2', a: '1' })).toBe('{"a":"1","b":"2"}')
  })

  it('returns null for empty objects', () => {
    expect(canonicalNotesJson({})).toBeNull()
    expect(canonicalNotesJson(null)).toBeNull()
  })

  it('drops null-valued keys', () => {
    expect(canonicalNotesJson({ a: '1', b: null })).toBe('{"a":"1"}')
  })
})

describe('diffRsvpResponse', () => {
  it('returns insert when no latest row exists', () => {
    const r = diffRsvpResponse({
      latest: null,
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_a' } },
    })
    expect(r).toEqual({ insert: true, notesJson: '{"meal_choice":"opt_a"}' })
  })

  it('skips insert when status and notes_json are unchanged', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: '{"meal_choice":"opt_a"}' },
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_a' } },
    })
    expect(r).toEqual({ insert: false })
  })

  it('inserts when status changes', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: null },
      submitted: { status: 'declined', notesJson: {} },
    })
    expect(r.insert).toBe(true)
  })

  it('inserts when notes_json changes', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: '{"meal_choice":"opt_a"}' },
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_b' } },
    })
    expect(r.insert).toBe(true)
  })

  it('treats differently-ordered submitted notesJson as equal to canonical latest', () => {
    const r = diffRsvpResponse({
      latest: {
        status: 'attending',
        notesJson: '{"a":"1","b":"2"}',
      },
      submitted: { status: 'attending', notesJson: { b: '2', a: '1' } },
    })
    expect(r).toEqual({ insert: false })
  })
})

describe('diffGuestResponse', () => {
  it('returns insert when no latest row exists', () => {
    const r = diffGuestResponse({
      latest: null,
      submitted: { notes: 'hi', notesJson: { dietary_restrictions: 'vegan' } },
    })
    expect(r.insert).toBe(true)
  })

  it('skips insert when notes and notes_json are unchanged', () => {
    const r = diffGuestResponse({
      latest: { notes: 'hi', notesJson: '{"dietary_restrictions":"vegan"}' },
      submitted: { notes: 'hi', notesJson: { dietary_restrictions: 'vegan' } },
    })
    expect(r.insert).toBe(false)
  })

  it('treats null and "" notes as equal', () => {
    const r = diffGuestResponse({
      latest: { notes: null, notesJson: null },
      submitted: { notes: '', notesJson: {} },
    })
    expect(r.insert).toBe(false)
  })

  it('skips insert when latest has no rows and submitted is empty', () => {
    const r = diffGuestResponse({
      latest: null,
      submitted: { notes: null, notesJson: {} },
    })
    expect(r.insert).toBe(false)
  })
})
