import type {
  GuestEventResponse,
  GuestResponseSubmission,
  RsvpGroupResponse,
} from '../schema'

// The form owns one draft per guest in the party. When a draft's
// `respondingFor` is false, the guest is excluded from the final submission
// payload (the acting user opted not to respond on their behalf).
export interface GuestResponseDraft extends GuestResponseSubmission {
  respondingFor: boolean
}

export interface RsvpFormState {
  drafts: Record<string, GuestResponseDraft>
  // Ordered ids the UI walks through. The acting guest is first.
  guestOrder: string[]
  respondedByGuestId: string
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
  const responsesByGuestId = new Map(data.responses.map((r) => [r.guestId, r]))
  const ordered = [
    ...data.guests.filter((g) => g.id === data.actingGuestId),
    ...data.guests.filter((g) => g.id !== data.actingGuestId),
  ]
  const drafts: Record<string, GuestResponseDraft> = {}
  for (const g of ordered) {
    const r = responsesByGuestId.get(g.id)
    const events: GuestEventResponse[] = (r?.events ?? []).map((e) => ({
      eventId: e.eventId,
      status: e.status,
      notesJson: { ...e.notesJson },
    }))
    drafts[g.id] = {
      guestId: g.id,
      notesJson: { ...(r?.notesJson ?? {}) },
      events,
      respondingFor: true,
    }
  }
  return {
    drafts,
    guestOrder: ordered.map((g) => g.id),
    respondedByGuestId: data.actingGuestId || ordered[0]?.id || '',
  }
}
