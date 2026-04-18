import { getDb, newId, type Env } from '../../lib/db'
import { jsonError, parseJson } from '../../lib/responses'
import { adminEventInputSchema } from '@shared/schemas/admin'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = getDb(context.env.DB)
  const events = await db
    .selectFrom('event')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  const meals = await db.selectFrom('meal_option').selectAll().execute()
  return Response.json({
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
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const parsed = await parseJson(context.request, adminEventInputSchema)
  if ('error' in parsed) return parsed.error
  const input = parsed.data

  const db = getDb(context.env.DB)
  const id = input.id ?? newId('evt')
  const sortOrder = input.sortOrder ?? 0
  const mealOptions = input.mealOptions ?? []

  if (input.id) {
    await db
      .updateTable('event')
      .set({
        name: input.name,
        slug: input.slug,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        location_name: input.locationName ?? null,
        address: input.address ?? null,
        rsvp_deadline: input.rsvpDeadline ?? null,
        requires_meal_choice: input.requiresMealChoice ? 1 : 0,
        sort_order: sortOrder,
      })
      .where('id', '=', input.id)
      .execute()
  } else {
    const slugConflict = await db
      .selectFrom('event')
      .select(['id'])
      .where('slug', '=', input.slug)
      .executeTakeFirst()
    if (slugConflict) return jsonError(409, 'Event slug already exists')
    await db
      .insertInto('event')
      .values({
        id,
        name: input.name,
        slug: input.slug,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        location_name: input.locationName ?? null,
        address: input.address ?? null,
        rsvp_deadline: input.rsvpDeadline ?? null,
        requires_meal_choice: input.requiresMealChoice ? 1 : 0,
        sort_order: sortOrder,
      })
      .execute()
  }

  // Reset meal options to match input.
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

  return Response.json({ id })
}
