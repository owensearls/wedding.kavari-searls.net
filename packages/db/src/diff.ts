import type { NotesJson } from './notesSchema'

export type { NotesJson, NotesJsonValue } from './notesSchema'

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

export interface RsvpDiffInput {
  latest: { status: 'attending' | 'declined'; notesJson: string | null } | null
  submitted: {
    status: 'attending' | 'declined'
    notesJson: NotesJson
  }
}

export type RsvpDiffResult =
  | { insert: false }
  | { insert: true; notesJson: string | null }

export function diffRsvpResponse(input: RsvpDiffInput): RsvpDiffResult {
  const nextCanonical = canonicalNotesJson(input.submitted.notesJson)
  if (input.latest === null) {
    return { insert: true, notesJson: nextCanonical }
  }
  if (
    input.latest.status === input.submitted.status &&
    (input.latest.notesJson ?? null) === nextCanonical
  ) {
    return { insert: false }
  }
  return { insert: true, notesJson: nextCanonical }
}

export interface GuestDiffInput {
  latest: { notes: string | null; notesJson: string | null } | null
  submitted: { notes: string | null; notesJson: NotesJson }
}

export type GuestDiffResult =
  | { insert: false }
  | { insert: true; notes: string | null; notesJson: string | null }

export function diffGuestResponse(input: GuestDiffInput): GuestDiffResult {
  const nextNotes = normaliseNotes(input.submitted.notes)
  const nextCanonical = canonicalNotesJson(input.submitted.notesJson)
  if (input.latest === null) {
    if (nextNotes === null && nextCanonical === null) return { insert: false }
    return { insert: true, notes: nextNotes, notesJson: nextCanonical }
  }
  if (
    (input.latest.notes ?? null) === nextNotes &&
    (input.latest.notesJson ?? null) === nextCanonical
  ) {
    return { insert: false }
  }
  return { insert: true, notes: nextNotes, notesJson: nextCanonical }
}

function normaliseNotes(s: string | null): string | null {
  if (s === null) return null
  const trimmed = s.trim()
  return trimmed === '' ? null : trimmed
}
