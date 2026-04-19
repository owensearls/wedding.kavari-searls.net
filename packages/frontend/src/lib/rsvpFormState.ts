import type { RsvpGroupResponse, RsvpStatus } from '@shared/schemas/rsvp'

export type RsvpKey = `${string}::${string}` // guestId::eventId

export interface RsvpFormState {
  rsvps: Record<RsvpKey, { status: RsvpStatus; mealChoiceId: string | null }>
  dietary: Record<string, string>
  notes: Record<string, string>
  songs: Record<string, { title: string; artist: string }>
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
        mealChoiceId: existing?.mealChoiceId ?? null,
      }
    }
  }
  const dietary: RsvpFormState['dietary'] = {}
  const notes: RsvpFormState['notes'] = {}
  const songs: RsvpFormState['songs'] = {}
  for (const g of data.guests) {
    dietary[g.id] = g.dietaryRestrictions ?? ''
    notes[g.id] = g.notes ?? ''
    const sr = g.notesJson?.songRequest
    songs[g.id] = {
      title: sr?.title ?? '',
      artist: sr?.artist ?? '',
    }
  }
  return {
    rsvps,
    dietary,
    notes,
    songs,
    respondedByGuestId: data.actingGuestId || data.guests[0]?.id || '',
  }
}
