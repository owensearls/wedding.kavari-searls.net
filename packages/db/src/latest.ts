import type { Db } from './db'
import type { CustomFieldConfig } from './diff'

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

export async function loadEventCustomFields(
  db: Db,
  eventIds: string[]
): Promise<Map<string, CustomFieldConfig[]>> {
  const out = new Map<string, CustomFieldConfig[]>()
  if (eventIds.length === 0) return out
  const fields = await db
    .selectFrom('event_custom_field')
    .selectAll()
    .where('event_id', 'in', eventIds)
    .orderBy(['event_id', 'sort_order'])
    .execute()
  if (fields.length === 0) return out
  const fieldIds = fields.map((f) => f.id)
  const options = await db
    .selectFrom('event_custom_field_option')
    .selectAll()
    .where('field_id', 'in', fieldIds)
    .orderBy(['field_id', 'sort_order'])
    .execute()
  const optionsByField = new Map<string, CustomFieldConfig['options']>()
  for (const o of options) {
    const arr = optionsByField.get(o.field_id) ?? []
    arr.push({ id: o.id, label: o.label, description: o.description, sortOrder: o.sort_order })
    optionsByField.set(o.field_id, arr)
  }
  for (const f of fields) {
    const arr = out.get(f.event_id) ?? []
    arr.push({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      sortOrder: f.sort_order,
      options: optionsByField.get(f.id) ?? [],
    })
    out.set(f.event_id, arr)
  }
  return out
}

export async function loadGuestCustomFields(
  db: Db
): Promise<CustomFieldConfig[]> {
  const fields = await db
    .selectFrom('guest_custom_field')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  if (fields.length === 0) return []
  const fieldIds = fields.map((f) => f.id)
  const options = await db
    .selectFrom('guest_custom_field_option')
    .selectAll()
    .where('field_id', 'in', fieldIds)
    .orderBy(['field_id', 'sort_order'])
    .execute()
  const optionsByField = new Map<string, CustomFieldConfig['options']>()
  for (const o of options) {
    const arr = optionsByField.get(o.field_id) ?? []
    arr.push({ id: o.id, label: o.label, description: o.description, sortOrder: o.sort_order })
    optionsByField.set(o.field_id, arr)
  }
  return fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    sortOrder: f.sort_order,
    options: optionsByField.get(f.id) ?? [],
  }))
}
