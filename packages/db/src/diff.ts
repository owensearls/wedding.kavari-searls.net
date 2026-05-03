export interface CustomFieldOption {
  id: string
  label: string
  description: string | null
  sortOrder: number
}

export interface CustomFieldConfig {
  id: string
  key: string
  label: string
  type: 'short_text' | 'single_select'
  sortOrder: number
  options: CustomFieldOption[]
}

export type NotesJsonValue = string | null
export type NotesJson = Record<string, NotesJsonValue>

export type ValidationResult =
  | { ok: true; value: NotesJson }
  | { ok: false; error: string }

const SHORT_TEXT_MAX = 500

/**
 * Validate a notes_json blob against a list of field configs.
 * Returns a sanitized clone (trimmed strings, empty -> null).
 */
export function validateNotesJson(
  input: NotesJson | null | undefined,
  fields: CustomFieldConfig[]
): ValidationResult {
  if (!input) return { ok: true, value: {} }
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const out: NotesJson = {}
  for (const [key, raw] of Object.entries(input)) {
    const field = byKey.get(key)
    if (!field) return { ok: false, error: `Unknown field: ${key}` }
    if (raw === null || raw === undefined) {
      out[key] = null
      continue
    }
    if (typeof raw !== 'string') {
      return { ok: false, error: `Field ${key} must be a string or null` }
    }
    if (field.type === 'short_text') {
      const trimmed = raw.trim()
      if (trimmed.length > SHORT_TEXT_MAX) {
        return {
          ok: false,
          error: `Field ${key} exceeds ${SHORT_TEXT_MAX} chars`,
        }
      }
      out[key] = trimmed === '' ? null : trimmed
    } else {
      const validIds = new Set(field.options.map((o) => o.id))
      if (raw === '') {
        out[key] = null
      } else if (!validIds.has(raw)) {
        return { ok: false, error: `Field ${key} value not in options` }
      } else {
        out[key] = raw
      }
    }
  }
  return { ok: true, value: out }
}

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
