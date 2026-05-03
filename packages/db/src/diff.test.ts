import { describe, expect, it } from 'vitest'
import {
  canonicalNotesJson,
  diffGuestResponse,
  diffRsvpResponse,
  validateNotesJson,
  type CustomFieldConfig,
} from './diff'

const shortText: CustomFieldConfig = {
  id: 'f1',
  key: 'dietary_restrictions',
  label: 'Dietary',
  type: 'short_text',
  sortOrder: 0,
  options: [],
}

const select: CustomFieldConfig = {
  id: 'f2',
  key: 'meal_choice',
  label: 'Meal',
  type: 'single_select',
  sortOrder: 0,
  options: [
    { id: 'opt_a', label: 'Chicken', description: null },
    { id: 'opt_b', label: 'Fish', description: null },
  ],
}

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

describe('validateNotesJson', () => {
  it('accepts valid short_text', () => {
    expect(
      validateNotesJson({ dietary_restrictions: 'vegan' }, [shortText])
    ).toEqual({ ok: true, value: { dietary_restrictions: 'vegan' } })
  })

  it('trims and empties short_text', () => {
    expect(
      validateNotesJson({ dietary_restrictions: '   ' }, [shortText])
    ).toEqual({ ok: true, value: { dietary_restrictions: null } })
  })

  it('rejects unknown keys', () => {
    const r = validateNotesJson({ surprise: 'x' }, [shortText])
    expect(r.ok).toBe(false)
  })

  it('rejects single_select values not in options', () => {
    const r = validateNotesJson({ meal_choice: 'opt_z' }, [select])
    expect(r.ok).toBe(false)
  })

  it('accepts known single_select option ids', () => {
    expect(validateNotesJson({ meal_choice: 'opt_a' }, [select])).toEqual({
      ok: true,
      value: { meal_choice: 'opt_a' },
    })
  })

  it('accepts null for any field', () => {
    expect(validateNotesJson({ meal_choice: null }, [select])).toEqual({
      ok: true,
      value: { meal_choice: null },
    })
  })

  it('rejects short_text longer than 500 chars', () => {
    const r = validateNotesJson(
      { dietary_restrictions: 'x'.repeat(501) },
      [shortText]
    )
    expect(r.ok).toBe(false)
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
