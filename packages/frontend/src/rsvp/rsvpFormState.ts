import type { NotesJson, RsvpGroupResponse, RsvpStatus } from '../schema'
import type { NotesFieldSchema } from 'db'

export type RsvpKey = `${string}::${string}`

export interface RsvpFormState {
  rsvps: Record<
    RsvpKey,
    { status: RsvpStatus | 'pending'; notesJson: NotesJson }
  >
  guestNotesJson: Record<string, NotesJson>
  guestNotes: Record<string, string>
  respondedByGuestId: string
}

export function rsvpKey(guestId: string, eventId: string): RsvpKey {
  return `${guestId}::${eventId}` as RsvpKey
}

export function formatRsvpDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export function buildInitialRsvpFormState(
  data: RsvpGroupResponse
): RsvpFormState {
  const rsvps: RsvpFormState['rsvps'] = {}
  for (const ev of data.events) {
    for (const guestId of ev.invitedGuestIds) {
      const existing = data.rsvps.find(
        (r) => r.guestId === guestId && r.eventId === ev.id
      )
      rsvps[rsvpKey(guestId, ev.id)] = {
        status: existing?.status ?? 'pending',
        notesJson: existing?.notesJson ?? {},
      }
    }
  }
  const guestNotesJson: Record<string, NotesJson> = {}
  const guestNotes: Record<string, string> = {}
  for (const g of data.guests) {
    guestNotesJson[g.id] = g.notesJson ?? {}
    guestNotes[g.id] = g.notes ?? ''
  }
  return {
    rsvps,
    guestNotesJson,
    guestNotes,
    respondedByGuestId: data.actingGuestId || data.guests[0]?.id || '',
  }
}

export function defaultValueForField(
  key: string,
  _field: NotesFieldSchema,
  current: NotesJson
): string {
  const v = current[key]
  return typeof v === 'string' ? v : ''
}
