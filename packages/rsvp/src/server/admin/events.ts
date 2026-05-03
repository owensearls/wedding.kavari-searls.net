'use server'

import { getDb, loadEventCustomFields, newId } from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import { adminEventInputSchema, type AdminEventInput } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export interface AdminEventRecord extends AdminEventInput {
  id: string
}

export async function listEvents(): Promise<{ events: AdminEventRecord[] }> {
  const db = getDbConn()
  const events = await db
    .selectFrom('event')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  if (events.length === 0) return { events: [] }
  const customFieldsByEvent = await loadEventCustomFields(
    db,
    events.map((e) => e.id)
  )
  return {
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      locationName: e.location_name,
      address: e.address,
      rsvpDeadline: e.rsvp_deadline,
      sortOrder: e.sort_order,
      customFields: customFieldsByEvent.get(e.id) ?? [],
    })),
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
      })
      .execute()
  }

  // Diff custom fields: delete any not in submission, upsert the rest.
  const submittedFieldIds = new Set(
    data.customFields.map((f) => f.id).filter((x): x is string => !!x)
  )
  const existing = await db
    .selectFrom('event_custom_field')
    .select(['id'])
    .where('event_id', '=', id)
    .execute()
  for (const ex of existing) {
    if (!submittedFieldIds.has(ex.id)) {
      await db
        .deleteFrom('event_custom_field')
        .where('id', '=', ex.id)
        .execute()
    }
  }

  for (const f of data.customFields) {
    const fieldId = f.id ?? newId('ecf')
    if (f.id) {
      await db
        .updateTable('event_custom_field')
        .set({
          key: f.key,
          label: f.label,
          type: f.type,
          sort_order: f.sortOrder,
        })
        .where('id', '=', f.id)
        .execute()
    } else {
      await db
        .insertInto('event_custom_field')
        .values({
          id: fieldId,
          event_id: id,
          key: f.key,
          label: f.label,
          type: f.type,
          sort_order: f.sortOrder,
        })
        .execute()
    }

    // Diff options for single_select fields.
    const submittedOptionIds = new Set(
      f.options.map((o) => o.id).filter((x): x is string => !!x)
    )
    const existingOptions = await db
      .selectFrom('event_custom_field_option')
      .select(['id'])
      .where('field_id', '=', fieldId)
      .execute()
    for (const eo of existingOptions) {
      if (!submittedOptionIds.has(eo.id)) {
        await db
          .deleteFrom('event_custom_field_option')
          .where('id', '=', eo.id)
          .execute()
      }
    }
    for (const o of f.options) {
      if (o.id) {
        await db
          .updateTable('event_custom_field_option')
          .set({
            label: o.label,
            description: o.description ?? null,
            sort_order: o.sortOrder,
          })
          .where('id', '=', o.id)
          .execute()
      } else {
        await db
          .insertInto('event_custom_field_option')
          .values({
            id: newId('ecfo'),
            field_id: fieldId,
            label: o.label,
            description: o.description ?? null,
            sort_order: o.sortOrder,
          })
          .execute()
      }
    }
  }

  return { id }
}

export async function deleteEvent(id: string): Promise<{ ok: true }> {
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('event').where('id', '=', id).execute()
  return { ok: true }
}
