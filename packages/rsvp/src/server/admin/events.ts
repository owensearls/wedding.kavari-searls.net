'use server'

import {
  adminEventInputSchema,
  type AdminEventInput,
} from 'schema/admin'
import { getDb, newId } from 'db'
import { getEnv } from 'db/context'

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
  const meals = await db.selectFrom('meal_option').selectAll().execute()
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
      requiresMealChoice: !!e.requires_meal_choice,
      sortOrder: e.sort_order,
      mealOptions: meals
        .filter((m) => m.event_id === e.id)
        .map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
        })),
    })),
  }
}

export async function saveEvent(
  input: AdminEventInput
): Promise<{ id: string }> {
  const parsed = adminEventInputSchema.safeParse(input)
  if (!parsed.success) throw new Error('Invalid event data')
  const data = parsed.data

  const db = getDbConn()
  const id = data.id ?? newId('evt')
  const sortOrder = data.sortOrder ?? 0
  const mealOptions = data.mealOptions ?? []

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
        requires_meal_choice: data.requiresMealChoice ? 1 : 0,
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
    if (slugConflict) throw new Error('Event slug already exists')
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
        requires_meal_choice: data.requiresMealChoice ? 1 : 0,
        sort_order: sortOrder,
      })
      .execute()
  }

  await db.deleteFrom('meal_option').where('event_id', '=', id).execute()
  for (const m of mealOptions) {
    await db
      .insertInto('meal_option')
      .values({
        id: m.id ?? newId('meal'),
        event_id: id,
        label: m.label,
        description: m.description ?? null,
      })
      .execute()
  }

  return { id }
}
