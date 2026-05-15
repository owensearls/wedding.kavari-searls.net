import type { Db } from './db'

export interface LatestRsvpResponseRow {
  id: string
  guestId: string
  eventId: string
  status: 'attending' | 'declined'
  notesJson: string | null
  respondedAt: string
  respondedByGuestId: string | null
}

export async function latestRsvpResponses(
  db: Db,
  filter?: { guestIds?: string[]; eventIds?: string[] }
): Promise<LatestRsvpResponseRow[]> {
  let q = db.selectFrom('rsvp_response').selectAll()
  if (filter?.guestIds && filter.guestIds.length > 0) {
    q = q.where('guest_id', 'in', filter.guestIds)
  }
  if (filter?.eventIds && filter.eventIds.length > 0) {
    q = q.where('event_id', 'in', filter.eventIds)
  }
  const rows = await q.execute()
  type R = (typeof rows)[number]
  const byKey = new Map<string, R>()
  for (const r of rows) {
    const k = `${r.guest_id}::${r.event_id}`
    const prev = byKey.get(k)
    if (
      !prev ||
      r.responded_at > prev.responded_at ||
      (r.responded_at === prev.responded_at && r.id > prev.id)
    ) {
      byKey.set(k, r)
    }
  }
  return [...byKey.values()].map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    eventId: r.event_id,
    status: r.status,
    notesJson: r.notes_json,
    respondedAt: r.responded_at,
    respondedByGuestId: r.responded_by_guest_id,
  }))
}

export interface LatestGuestResponseRow {
  id: string
  guestId: string
  notes: string | null
  notesJson: string | null
  respondedAt: string
  respondedByGuestId: string | null
}

export async function latestGuestResponses(
  db: Db,
  filter?: { guestIds?: string[] }
): Promise<LatestGuestResponseRow[]> {
  let q = db.selectFrom('guest_response').selectAll()
  if (filter?.guestIds && filter.guestIds.length > 0) {
    q = q.where('guest_id', 'in', filter.guestIds)
  }
  const rows = await q.execute()
  type R = (typeof rows)[number]
  const byKey = new Map<string, R>()
  for (const r of rows) {
    const prev = byKey.get(r.guest_id)
    if (
      !prev ||
      r.responded_at > prev.responded_at ||
      (r.responded_at === prev.responded_at && r.id > prev.id)
    ) {
      byKey.set(r.guest_id, r)
    }
  }
  return [...byKey.values()].map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    notes: r.notes,
    notesJson: r.notes_json,
    respondedAt: r.responded_at,
    respondedByGuestId: r.responded_by_guest_id,
  }))
}
