'use server'

import {
  fieldsInOrder,
  getDb,
  latestGuestResponses,
  newId,
  parseNotesSchema,
  stringifyNotesSchema,
  type NotesJsonSchema,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  adminEventInputSchema,
  type AdminEventInput,
  type AdminFieldDraft,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export interface AdminEventRecord extends AdminEventInput {
  id: string
  schemaMalformed?: boolean
  schemaError?: string
  schemaRaw?: string | null
}

function schemaToDrafts(schema: NotesJsonSchema | null): AdminFieldDraft[] {
  if (!schema) return []
  return fieldsInOrder(schema).map(({ key, field }) => ({ key, field }))
}

function draftsToSchema(drafts: AdminFieldDraft[]): NotesJsonSchema | null {
  if (drafts.length === 0) return null
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    'x-fieldOrder': drafts.map((d) => d.key),
    properties: Object.fromEntries(drafts.map((d) => [d.key, d.field])),
  }
}

export interface AdminEventStats {
  eventId: string
  invitedCount: number
  attendingCount: number
  declinedCount: number
  pendingCount: number
}

export async function listEventStats(): Promise<{ stats: AdminEventStats[] }> {
  const db = getDbConn()

  const events = await db.selectFrom('event').select('id').execute()
  if (events.length === 0) return { stats: [] }
  const eventIds = events.map((e) => e.id)

  const invitations = await db
    .selectFrom('invitation')
    .select(['guest_id', 'event_id'])
    .where('event_id', 'in', eventIds)
    .execute()

  if (invitations.length === 0) {
    return {
      stats: events.map((e) => ({
        eventId: e.id,
        invitedCount: 0,
        attendingCount: 0,
        declinedCount: 0,
        pendingCount: 0,
      })),
    }
  }

  const leaderIds = [...new Set(invitations.map((i) => i.guest_id))]

  const partyMembers = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where((eb) =>
      eb.or([eb('id', 'in', leaderIds), eb('party_leader_id', 'in', leaderIds)])
    )
    .execute()

  const partyByLeader = new Map<string, string[]>()
  for (const m of partyMembers) {
    const leaderId = m.party_leader_id ?? m.id
    const arr = partyByLeader.get(leaderId) ?? []
    arr.push(m.id)
    partyByLeader.set(leaderId, arr)
  }

  // For each event, collect the set of guest ids that party-belong to a
  // leader invited to that event. Use a Set to avoid double-counting if a
  // guest somehow appears in multiple leader's parties.
  const invitedGuestsByEvent = new Map<string, Set<string>>()
  for (const inv of invitations) {
    const guests = partyByLeader.get(inv.guest_id) ?? []
    let set = invitedGuestsByEvent.get(inv.event_id)
    if (!set) {
      set = new Set<string>()
      invitedGuestsByEvent.set(inv.event_id, set)
    }
    for (const g of guests) set.add(g)
  }

  const allGuestIds = [...new Set(partyMembers.map((m) => m.id))]
  const latest =
    allGuestIds.length > 0
      ? await latestGuestResponses(db, { guestIds: allGuestIds })
      : []
  const statusByKey = new Map<string, 'attending' | 'declined'>()
  for (const lr of latest) {
    for (const e of lr.events) {
      statusByKey.set(`${lr.guestId}::${e.eventId}`, e.status)
    }
  }

  return {
    stats: events.map((e) => {
      const invited = invitedGuestsByEvent.get(e.id) ?? new Set<string>()
      let attending = 0
      let declined = 0
      for (const guestId of invited) {
        const status = statusByKey.get(`${guestId}::${e.id}`)
        if (status === 'attending') attending++
        else if (status === 'declined') declined++
      }
      return {
        eventId: e.id,
        invitedCount: invited.size,
        attendingCount: attending,
        declinedCount: declined,
        pendingCount: invited.size - attending - declined,
      }
    }),
  }
}

export async function listEvents(): Promise<{ events: AdminEventRecord[] }> {
  const db = getDbConn()
  const events = await db
    .selectFrom('event')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  if (events.length === 0) return { events: [] }
  return {
    events: events.map((e) => {
      const base = {
        id: e.id,
        name: e.name,
        slug: e.slug,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        locationName: e.location_name,
        address: e.address,
        rsvpDeadline: e.rsvp_deadline,
        sortOrder: e.sort_order,
      }
      let schema: NotesJsonSchema | null
      try {
        schema = parseNotesSchema(e.notes_schema)
        validateNotesSchemaShape(schema)
      } catch (err) {
        return {
          ...base,
          notesSchema: [],
          schemaMalformed: true,
          schemaError:
            err instanceof Error ? err.message : 'Unknown schema error',
          schemaRaw: e.notes_schema,
        }
      }
      return { ...base, notesSchema: schemaToDrafts(schema) }
    }),
  }
}

function validateNotesSchemaShape(schema: NotesJsonSchema | null): void {
  if (schema === null) return
  if (typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Schema must be a JSON object')
  }
  if (schema.type !== 'object') {
    throw new Error('Schema "type" must be "object"')
  }
  if (!Array.isArray(schema['x-fieldOrder'])) {
    throw new Error('Schema is missing "x-fieldOrder" array')
  }
  if (!schema.properties || typeof schema.properties !== 'object') {
    throw new Error('Schema is missing "properties" object')
  }
  for (const key of schema['x-fieldOrder']) {
    const field = schema.properties[key]
    if (!field) {
      throw new Error(`Field "${key}" listed in x-fieldOrder but not defined`)
    }
    const isShortText =
      'type' in field && (field as { type: string }).type === 'string'
    const isSingleSelect =
      'oneOf' in field && Array.isArray((field as { oneOf: unknown }).oneOf)
    if (!isShortText && !isSingleSelect) {
      throw new Error(`Field "${key}" has unknown shape`)
    }
  }
}

export async function saveEvent(
  input: AdminEventInput
): Promise<{ id: string }> {
  try {
    return await saveEventInner(input)
  } catch (err) {
    if (err instanceof RscFunctionError) throw err
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    throw new RscFunctionError(500, `Save failed: ${message}`)
  }
}

async function saveEventInner(input: AdminEventInput): Promise<{ id: string }> {
  const parsed = adminEventInputSchema.safeParse(input)
  if (!parsed.success) throw new RscFunctionError(400, 'Invalid event data')
  const data = parsed.data

  const db = getDbConn()
  const id = data.id ?? newId('evt')
  const sortOrder = data.sortOrder ?? 0

  const schema = draftsToSchema(data.notesSchema)
  const notes_schema = schema ? stringifyNotesSchema(schema) : null

  if (data.id) {
    await db
      .updateTable('event')
      .set({
        name: data.name,
        slug: data.slug,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        location_name: data.locationName ?? null,
        address: data.address ?? null,
        rsvp_deadline: data.rsvpDeadline ?? null,
        sort_order: sortOrder,
        notes_schema,
      })
      .where('id', '=', data.id)
      .execute()
  } else {
    const slugConflict = await db
      .selectFrom('event')
      .select(['id'])
      .where('slug', '=', data.slug)
      .executeTakeFirst()
    if (slugConflict)
      throw new RscFunctionError(409, 'Event slug already exists')
    await db
      .insertInto('event')
      .values({
        id,
        name: data.name,
        slug: data.slug,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        location_name: data.locationName ?? null,
        address: data.address ?? null,
        rsvp_deadline: data.rsvpDeadline ?? null,
        sort_order: sortOrder,
        notes_schema,
      })
      .execute()
  }

  return { id }
}

export async function deleteEvent(id: string): Promise<{ ok: true }> {
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('event').where('id', '=', id).execute()
  return { ok: true }
}
