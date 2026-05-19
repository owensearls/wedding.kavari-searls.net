import type { Db } from './db'

export interface LatestEventResponse {
  eventId: string
  status: 'attending' | 'declined'
  notesJson: string | null
}

export interface LatestGuestResponseRow {
  id: string
  guestId: string
  notesJson: string | null
  respondedAt: string
  respondedByGuestId: string | null
  events: LatestEventResponse[]
}

/**
 * Returns the latest guest_response row per guest, hydrated with its
 * guest_invitation_response children. A guest with no submissions yet is
 * omitted from the result entirely (callers fall back to "pending").
 */
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
  const byGuest = new Map<string, R>()
  for (const r of rows) {
    const prev = byGuest.get(r.guest_id)
    if (
      !prev ||
      r.responded_at > prev.responded_at ||
      (r.responded_at === prev.responded_at && r.id > prev.id)
    ) {
      byGuest.set(r.guest_id, r)
    }
  }

  const latest = [...byGuest.values()]
  if (latest.length === 0) return []

  const responseIds = latest.map((r) => r.id)
  const children = await db
    .selectFrom('guest_invitation_response')
    .selectAll()
    .where('guest_response_id', 'in', responseIds)
    .execute()
  const childrenByResponse = new Map<string, LatestEventResponse[]>()
  for (const c of children) {
    const arr = childrenByResponse.get(c.guest_response_id) ?? []
    arr.push({
      eventId: c.event_id,
      status: c.status,
      notesJson: c.notes_json,
    })
    childrenByResponse.set(c.guest_response_id, arr)
  }

  return latest.map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    notesJson: r.notes_json,
    respondedAt: r.responded_at,
    respondedByGuestId: r.responded_by_guest_id,
    events: childrenByResponse.get(r.id) ?? [],
  }))
}
