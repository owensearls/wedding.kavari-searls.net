import { describe, expect, it } from 'vitest'
import { canonicalNotesJson, diffGuestResponse } from './diff'

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

describe('diffGuestResponse', () => {
  it('returns insert when no latest exists and submitted has data', () => {
    const r = diffGuestResponse({
      latest: null,
      submitted: {
        notesJson: { dietary_restrictions: 'vegan' },
        events: [],
      },
    })
    expect(r.insert).toBe(true)
    if (r.insert) {
      expect(r.notesJson).toBe('{"dietary_restrictions":"vegan"}')
      expect(r.events).toEqual([])
    }
  })

  it('skips insert when latest has no rows and submitted is empty', () => {
    const r = diffGuestResponse({
      latest: null,
      submitted: { notesJson: {}, events: [] },
    })
    expect(r.insert).toBe(false)
  })

  it('skips insert when notes and events are unchanged', () => {
    const r = diffGuestResponse({
      latest: {
        notesJson: '{"a":"1"}',
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: null }],
      },
      submitted: {
        notesJson: { a: '1' },
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: {} }],
      },
    })
    expect(r.insert).toBe(false)
  })

  it('inserts when an event status changes', () => {
    const r = diffGuestResponse({
      latest: {
        notesJson: null,
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: null }],
      },
      submitted: {
        notesJson: {},
        events: [{ eventId: 'evt_1', status: 'declined', notesJson: {} }],
      },
    })
    expect(r.insert).toBe(true)
  })

  it('inserts when an event is added', () => {
    const r = diffGuestResponse({
      latest: {
        notesJson: null,
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: null }],
      },
      submitted: {
        notesJson: {},
        events: [
          { eventId: 'evt_1', status: 'attending', notesJson: {} },
          { eventId: 'evt_2', status: 'declined', notesJson: {} },
        ],
      },
    })
    expect(r.insert).toBe(true)
  })

  it('replays full event set when any field changes', () => {
    const r = diffGuestResponse({
      latest: {
        notesJson: '{"a":"1"}',
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: null }],
      },
      submitted: {
        notesJson: { a: '2' },
        events: [{ eventId: 'evt_1', status: 'attending', notesJson: {} }],
      },
    })
    expect(r.insert).toBe(true)
    if (r.insert) {
      expect(r.notesJson).toBe('{"a":"2"}')
      expect(r.events).toEqual([
        { eventId: 'evt_1', status: 'attending', notesJson: null },
      ])
    }
  })
})
