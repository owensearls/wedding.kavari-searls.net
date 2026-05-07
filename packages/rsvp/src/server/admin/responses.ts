'use server'

import {
  fieldsInOrder,
  findOption,
  getDb,
  GUEST_PROFILE_NOTES_SCHEMA,
  isShortTextField,
  isSingleSelectField,
  latestGuestResponses,
  latestRsvpResponses,
  parseNotesSchema,
  type NotesJson,
  type NotesJsonSchema,
} from 'db'
import { getEnv } from 'db/context'
import type { AdminResponseRow } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): NotesJson {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function formatAnswersForCsv(
  schema: NotesJsonSchema | null,
  notesJson: NotesJson
): string {
  if (!schema) return ''
  const parts: string[] = []
  for (const { key, field } of fieldsInOrder(schema)) {
    const raw = notesJson[key]
    if (raw === null || raw === undefined || raw === '') continue
    let value = raw
    if (isSingleSelectField(field)) {
      const opt = findOption(field, raw)
      value = opt ? opt.title : `${raw} (legacy)`
    } else if (isShortTextField(field)) {
      value = raw
    }
    parts.push(`${field.title}: ${value}`)
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
    .select(['id', 'name', 'sort_order', 'notes_schema'])
    .orderBy('sort_order')
    .execute()
  const eventById = new Map(events.map((e) => [e.id, e]))
  const eventSchemaById = new Map<string, NotesJsonSchema | null>()
  for (const e of events) {
    try {
      eventSchemaById.set(e.id, parseNotesSchema(e.notes_schema))
    } catch {
      eventSchemaById.set(e.id, null)
    }
  }

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
    const guestResponse = guestRespMap.get(g.guestId)
    const guestAnswers = formatAnswersForCsv(
      GUEST_PROFILE_NOTES_SCHEMA,
      parseNotesJson(guestResponse?.notesJson ?? null)
    )
    for (const eid of eventIdsForGroup) {
      const ev = eventById.get(eid)
      if (!ev) continue
      const r = rsvpMap.get(rsvpKey(g.guestId, eid))
      const eventAnswers = formatAnswersForCsv(
        eventSchemaById.get(eid) ?? null,
        parseNotesJson(r?.notesJson ?? null)
      )
      const customAnswers = [eventAnswers, guestAnswers]
        .filter((s) => s.length > 0)
        .join('; ')
      out.push({
        groupLabel: g.groupLabel ?? '',
        inviteCode: g.inviteCode ?? '',
        guestName: g.guestName,
        eventName: ev.name,
        status: r?.status ?? 'pending',
        customAnswers,
        notes: guestResponse?.notes ?? null,
        respondedAt: r?.respondedAt ?? null,
      })
    }
  }
  return { rows: out }
}

// ── Merged log ──────────────────────────────────────────────────────────

export type LogRowKind = 'rsvp' | 'guest'

export interface AdminLogRow {
  id: string
  kind: LogRowKind
  respondedAt: string
  guestName: string
  subject: string | null
  status: 'attending' | 'declined' | null
  notes: string | null
  notesJson: NotesJson
  notesSchema: NotesJsonSchema | null
  respondedByDisplayName: string | null
}

export async function listLog(): Promise<{ rows: AdminLogRow[] }> {
  const db = getDbConn()

  const rsvpRows = await db
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
      'event.notes_schema as eventNotesSchema',
      'responder.display_name as responderName',
    ])
    .execute()

  const guestRows = await db
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
    .execute()

  const rsvpMapped: AdminLogRow[] = rsvpRows.map((r) => {
    let schema: NotesJsonSchema | null
    try {
      schema = parseNotesSchema(r.eventNotesSchema)
    } catch {
      schema = null
    }
    return {
      id: r.id,
      kind: 'rsvp',
      respondedAt: r.respondedAt,
      guestName: r.guestName,
      subject: r.eventName,
      status: r.status,
      notes: null,
      notesJson: parseNotesJson(r.notesJson),
      notesSchema: schema,
      respondedByDisplayName: r.responderName ?? null,
    }
  })

  const guestMapped: AdminLogRow[] = guestRows.map((r) => ({
    id: r.id,
    kind: 'guest',
    respondedAt: r.respondedAt,
    guestName: r.guestName,
    subject: null,
    status: null,
    notes: r.notes,
    notesJson: parseNotesJson(r.notesJson),
    notesSchema: GUEST_PROFILE_NOTES_SCHEMA,
    respondedByDisplayName: r.responderName ?? null,
  }))

  const all = [...rsvpMapped, ...guestMapped].sort((a, b) => {
    if (a.respondedAt === b.respondedAt) return a.id < b.id ? 1 : -1
    return a.respondedAt < b.respondedAt ? 1 : -1
  })

  return { rows: all }
}
