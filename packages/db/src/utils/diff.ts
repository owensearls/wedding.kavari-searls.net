import type { NotesJson } from '../notesSchema'

export type { NotesJson, NotesJsonValue } from '../notesSchema'

/**
 * Produce a deterministic JSON representation for diffing.
 * Drops null-valued keys; sorts keys; returns null for empty.
 */
export function canonicalNotesJson(input: NotesJson | null): string | null {
  if (!input) return null
  const entries = Object.entries(input).filter(([, v]) => v !== null)
  if (entries.length === 0) return null
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return JSON.stringify(Object.fromEntries(entries))
}

export interface GuestEventState {
  eventId: string
  status: 'attending' | 'declined'
  notesJson: NotesJson
}

export interface GuestDiffInput {
  latest: {
    notesJson: string | null
    events: Array<{
      eventId: string
      status: 'attending' | 'declined'
      notesJson: string | null
    }>
  } | null
  submitted: {
    notesJson: NotesJson
    events: GuestEventState[]
  }
}

export interface GuestDiffEventInsert {
  eventId: string
  status: 'attending' | 'declined'
  notesJson: string | null
}

export type GuestDiffResult =
  | { insert: false }
  | { insert: true; notesJson: string | null; events: GuestDiffEventInsert[] }

/**
 * Compare a guest's submitted state to their last-recorded state.
 * If anything changed (invite-level notes, any event status, any event
 * notes), return a new (notes, events[]) tuple to insert. Otherwise skip.
 *
 * The new row replays the full submitted state — events that didn't
 * change are still re-asserted as children, so each guest_response is a
 * complete snapshot of "what the guest most recently said."
 *
 * Invariant: `input.latest.notesJson` and each `input.latest.events[].notesJson`
 * are assumed to already be canonical strings (the write path always uses
 * `canonicalNotesJson`). If that ever stops holding, the equality check
 * below will spuriously insert a no-op row, but won't otherwise corrupt
 * data.
 */
export function diffGuestResponse(input: GuestDiffInput): GuestDiffResult {
  const nextNotes = canonicalNotesJson(input.submitted.notesJson)
  const nextEvents: GuestDiffEventInsert[] = input.submitted.events.map(
    (e) => ({
      eventId: e.eventId,
      status: e.status,
      notesJson: canonicalNotesJson(e.notesJson),
    })
  )
  // Stable order so equality comparisons are deterministic.
  nextEvents.sort((a, b) => (a.eventId < b.eventId ? -1 : 1))

  if (input.latest === null) {
    if (nextNotes === null && nextEvents.length === 0) return { insert: false }
    return { insert: true, notesJson: nextNotes, events: nextEvents }
  }

  const prevNotes = input.latest.notesJson ?? null
  const prevEventsByKey = new Map(
    input.latest.events.map((e) => [e.eventId, e])
  )
  let eventsMatch = prevEventsByKey.size === nextEvents.length
  if (eventsMatch) {
    for (const e of nextEvents) {
      const p = prevEventsByKey.get(e.eventId)
      if (
        !p ||
        p.status !== e.status ||
        (p.notesJson ?? null) !== e.notesJson
      ) {
        eventsMatch = false
        break
      }
    }
  }

  if (prevNotes === nextNotes && eventsMatch) {
    return { insert: false }
  }
  return { insert: true, notesJson: nextNotes, events: nextEvents }
}
