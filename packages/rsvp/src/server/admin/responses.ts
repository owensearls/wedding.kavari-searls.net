'use server'

import {
  fieldsInOrder,
  findOption,
  getDb,
  isShortTextField,
  isSingleSelectField,
  latestGuestResponses,
  parseNotesSchema,
  type NotesJson,
  type NotesJsonSchema,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
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

// Returns null on any parse error or structural mismatch, so downstream
// renderers can safely treat the event as "no custom fields".
function safeParseNotesSchema(raw: string | null): NotesJsonSchema | null {
  let parsed: unknown
  try {
    parsed = parseNotesSchema(raw)
  } catch {
    return null
  }
  if (parsed === null) return null
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const s = parsed as Partial<NotesJsonSchema>
  if (s.type !== 'object') return null
  if (!Array.isArray(s['x-fieldOrder'])) return null
  if (!s.properties || typeof s.properties !== 'object') return null
  return parsed as NotesJsonSchema
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
    eventSchemaById.set(e.id, safeParseNotesSchema(e.notes_schema))
  }

  const invitations = await db
    .selectFrom('invitation')
    .select(['guest_id', 'event_id', 'notes_schema'])
    .execute()
  const invitationSchemaByLeader = new Map<string, NotesJsonSchema | null>()
  for (const inv of invitations) {
    if (invitationSchemaByLeader.has(inv.guest_id)) continue
    invitationSchemaByLeader.set(
      inv.guest_id,
      safeParseNotesSchema(inv.notes_schema)
    )
  }

  const latest = await latestGuestResponses(db)
  const latestByGuestId = new Map(latest.map((r) => [r.guestId, r]))

  const out: AdminResponseRow[] = []
  for (const g of guests) {
    const leaderId = g.partyLeaderId ?? g.guestId
    const eventIdsForGroup = invitations
      .filter((i) => i.guest_id === leaderId)
      .map((i) => i.event_id)
    const lr = latestByGuestId.get(g.guestId)
    const guestEventByEventId = new Map(
      (lr?.events ?? []).map((e) => [e.eventId, e])
    )
    const inviteSchema = invitationSchemaByLeader.get(leaderId) ?? null
    const guestAnswers = formatAnswersForCsv(
      inviteSchema,
      parseNotesJson(lr?.notesJson ?? null)
    )
    for (const eid of eventIdsForGroup) {
      const ev = eventById.get(eid)
      if (!ev) continue
      const eventResp = guestEventByEventId.get(eid)
      const eventAnswers = formatAnswersForCsv(
        eventSchemaById.get(eid) ?? null,
        parseNotesJson(eventResp?.notesJson ?? null)
      )
      const customAnswers = [eventAnswers, guestAnswers]
        .filter((s) => s.length > 0)
        .join('; ')
      out.push({
        groupLabel: g.groupLabel ?? '',
        inviteCode: g.inviteCode ?? '',
        guestName: g.guestName,
        eventName: ev.name,
        status: eventResp?.status ?? 'pending',
        customAnswers,
        respondedAt: eventResp ? (lr?.respondedAt ?? null) : null,
      })
    }
  }
  return { rows: out }
}

// ── Merged log ──────────────────────────────────────────────────────────
//
// One log row per guest_response (the parent). Each carries the guest's
// invite-level notes plus the child event responses (status + per-event
// notes), matching the canonical guest-response data model.

export interface AdminLogEventEntry {
  eventId: string
  eventName: string
  status: 'attending' | 'declined'
  notesJson: NotesJson
  eventNotesSchema: NotesJsonSchema | null
}

export interface AdminLogRow {
  id: string
  respondedAt: string
  guestName: string
  notesJson: NotesJson
  invitationNotesSchema: NotesJsonSchema | null
  events: AdminLogEventEntry[]
  respondedByDisplayName: string | null
}

export async function listLog(): Promise<{ rows: AdminLogRow[] }> {
  try {
    return await listLogInner()
  } catch (err) {
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    throw new RscFunctionError(500, `Activity log failed: ${message}`)
  }
}

async function listLogInner(): Promise<{ rows: AdminLogRow[] }> {
  const db = getDbConn()

  const parents = await db
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
      'guest_response.notes_json as notesJson',
      'guest_response.guest_id as guestId',
      'guest.display_name as guestName',
      'guest.party_leader_id as partyLeaderId',
      'responder.display_name as responderName',
    ])
    .execute()

  if (parents.length === 0) return { rows: [] }

  const parentIds = parents.map((p) => p.id)
  const children = await db
    .selectFrom('guest_invitation_response')
    .innerJoin('event', 'event.id', 'guest_invitation_response.event_id')
    .select([
      'guest_invitation_response.guest_response_id as guestResponseId',
      'guest_invitation_response.event_id as eventId',
      'guest_invitation_response.status as status',
      'guest_invitation_response.notes_json as notesJson',
      'event.name as eventName',
      'event.notes_schema as eventNotesSchema',
    ])
    .where('guest_response_id', 'in', parentIds)
    .execute()

  const childrenByParent = new Map<string, typeof children>()
  for (const c of children) {
    const arr = childrenByParent.get(c.guestResponseId) ?? []
    arr.push(c)
    childrenByParent.set(c.guestResponseId, arr)
  }

  // Pull invitation notes_schema by leader (one per guest's party) so
  // each log row can render the invite-level answers with labels.
  const leaderIds = Array.from(
    new Set(parents.map((p) => p.partyLeaderId ?? p.guestId))
  )
  const invitations = leaderIds.length
    ? await db
        .selectFrom('invitation')
        .select(['guest_id', 'notes_schema'])
        .where('guest_id', 'in', leaderIds)
        .execute()
    : []
  const inviteSchemaByLeader = new Map<string, NotesJsonSchema | null>()
  for (const inv of invitations) {
    if (inviteSchemaByLeader.has(inv.guest_id)) continue
    inviteSchemaByLeader.set(
      inv.guest_id,
      safeParseNotesSchema(inv.notes_schema)
    )
  }

  const rows: AdminLogRow[] = parents.map((p) => {
    const leader = p.partyLeaderId ?? p.guestId
    const childRows = childrenByParent.get(p.id) ?? []
    return {
      id: p.id,
      respondedAt: p.respondedAt,
      guestName: p.guestName,
      notesJson: parseNotesJson(p.notesJson),
      invitationNotesSchema: inviteSchemaByLeader.get(leader) ?? null,
      events: childRows.map((c) => ({
        eventId: c.eventId,
        eventName: c.eventName,
        status: c.status,
        notesJson: parseNotesJson(c.notesJson),
        eventNotesSchema: safeParseNotesSchema(c.eventNotesSchema),
      })),
      respondedByDisplayName: p.responderName ?? null,
    }
  })

  rows.sort((a, b) => {
    if (a.respondedAt === b.respondedAt) return a.id < b.id ? 1 : -1
    return a.respondedAt < b.respondedAt ? 1 : -1
  })

  return { rows }
}
