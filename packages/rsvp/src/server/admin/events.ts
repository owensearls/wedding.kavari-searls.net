'use server'

import {
  fieldsInOrder,
  getDb,
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
      let schema: NotesJsonSchema | null
      try {
        schema = parseNotesSchema(e.notes_schema)
      } catch {
        throw new RscFunctionError(500, `Event schema is malformed: ${e.slug}`)
      }
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        locationName: e.location_name,
        address: e.address,
        rsvpDeadline: e.rsvp_deadline,
        sortOrder: e.sort_order,
        notesSchema: schemaToDrafts(schema),
      }
    }),
  }
}

export async function saveEvent(
  input: AdminEventInput
): Promise<{ id: string }> {
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
