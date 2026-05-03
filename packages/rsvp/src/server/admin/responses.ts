'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  type CustomFieldConfig as DbCustomFieldConfig,
} from 'db'
import { getEnv } from 'db/context'
import type { AdminResponseRow, CustomFieldConfig } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function formatCustomAnswersForCsv(
  notesJson: Record<string, string | null>,
  fields: DbCustomFieldConfig[]
): string {
  if (fields.length === 0) return ''
  const parts: string[] = []
  for (const f of fields) {
    const raw = notesJson[f.key]
    if (raw == null) continue
    let value = raw
    if (f.type === 'single_select') {
      const opt = f.options.find((o) => o.id === raw)
      value = opt ? opt.label : `(unknown ${raw})`
    }
    parts.push(`${f.label}: ${value}`)
  }
  return parts.join('; ')
}

export async function listResponses(): Promise<{ rows: AdminResponseRow[] }> {
  const db = getDbConn()

  const guests = await db
    .selectFrom('guest')
    .select([
      'id as guestId',
      'display_name as guestName',
      'invite_code as inviteCode',
      'party_leader_id as partyLeaderId',
      'group_label as groupLabel',
    ])
    .execute()

  const events = await db
    .selectFrom('event')
    .select(['id', 'name', 'sort_order'])
    .orderBy('sort_order')
    .execute()
  const eventById = new Map(events.map((e) => [e.id, e]))
  const eventIds = events.map((e) => e.id)
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)

  const invitations = await db
    .selectFrom('invitation')
    .select(['guest_id', 'event_id'])
    .execute()

  const latestRsvps = await latestRsvpResponses(db)
  const rsvpKey = (g: string, e: string) => `${g}::${e}`
  const rsvpMap = new Map(
    latestRsvps.map((r) => [rsvpKey(r.guestId, r.eventId), r])
  )

  const latestGuests = await latestGuestResponses(db)
  const guestRespMap = new Map(latestGuests.map((r) => [r.guestId, r]))

  const out: AdminResponseRow[] = []
  for (const g of guests) {
    const leaderId = g.partyLeaderId ?? g.guestId
    const eventIdsForGroup = invitations
      .filter((i) => i.guest_id === leaderId)
      .map((i) => i.event_id)
    for (const eid of eventIdsForGroup) {
      const ev = eventById.get(eid)
      if (!ev) continue
      const r = rsvpMap.get(rsvpKey(g.guestId, eid))
      const lg = guestRespMap.get(g.guestId)
      const customAnswers = formatCustomAnswersForCsv(
        parseNotesJson(r?.notesJson ?? null),
        eventCustomFieldsByEvent.get(eid) ?? []
      )
      out.push({
        groupLabel: g.groupLabel ?? '',
        inviteCode: g.inviteCode ?? '',
        guestName: g.guestName,
        eventName: ev.name,
        status: r?.status ?? 'pending',
        customAnswers,
        notes: lg?.notes ?? null,
        respondedAt: r?.respondedAt ?? null,
      })
    }
  }
  return { rows: out }
}

export interface AdminRsvpResponseLogRow {
  id: string
  respondedAt: string
  guestName: string
  eventName: string
  status: 'attending' | 'declined'
  notesJson: Record<string, string | null>
  respondedByDisplayName: string | null
  eventCustomFields: CustomFieldConfig[]
}

export async function listRsvpResponseLog(): Promise<{
  rows: AdminRsvpResponseLogRow[]
}> {
  const db = getDbConn()
  const rows = await db
    .selectFrom('rsvp_response')
    .innerJoin('guest', 'guest.id', 'rsvp_response.guest_id')
    .innerJoin('event', 'event.id', 'rsvp_response.event_id')
    .leftJoin(
      'guest as responder',
      'responder.id',
      'rsvp_response.responded_by_guest_id'
    )
    .select([
      'rsvp_response.id as id',
      'rsvp_response.responded_at as respondedAt',
      'rsvp_response.event_id as eventId',
      'rsvp_response.status as status',
      'rsvp_response.notes_json as notesJson',
      'guest.display_name as guestName',
      'event.name as eventName',
      'responder.display_name as responderName',
    ])
    .orderBy('rsvp_response.responded_at', 'desc')
    .execute()

  const eventIds = Array.from(new Set(rows.map((r) => r.eventId)))
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      respondedAt: r.respondedAt,
      guestName: r.guestName,
      eventName: r.eventName,
      status: r.status,
      notesJson: parseNotesJson(r.notesJson),
      respondedByDisplayName: r.responderName ?? null,
      eventCustomFields: eventCustomFieldsByEvent.get(r.eventId) ?? [],
    })),
  }
}

export interface AdminGuestResponseLogRow {
  id: string
  respondedAt: string
  guestName: string
  notes: string | null
  notesJson: Record<string, string | null>
  respondedByDisplayName: string | null
}

export async function listGuestResponseLog(): Promise<{
  rows: AdminGuestResponseLogRow[]
  guestCustomFields: CustomFieldConfig[]
}> {
  const db = getDbConn()
  const rows = await db
    .selectFrom('guest_response')
    .innerJoin('guest', 'guest.id', 'guest_response.guest_id')
    .leftJoin(
      'guest as responder',
      'responder.id',
      'guest_response.responded_by_guest_id'
    )
    .select([
      'guest_response.id as id',
      'guest_response.responded_at as respondedAt',
      'guest.display_name as guestName',
      'guest_response.notes as notes',
      'guest_response.notes_json as notesJson',
      'responder.display_name as responderName',
    ])
    .orderBy('guest_response.responded_at', 'desc')
    .execute()
  const guestCustomFields = await loadGuestCustomFields(db)
  return {
    rows: rows.map((r) => ({
      id: r.id,
      respondedAt: r.respondedAt,
      guestName: r.guestName,
      notes: r.notes,
      notesJson: parseNotesJson(r.notesJson),
      respondedByDisplayName: r.responderName ?? null,
    })),
    guestCustomFields,
  }
}
