import { getDb, newId, nowIso, type Env } from '../../lib/db'
import { jsonError, parseJson } from '../../lib/responses'
import {
  rsvpSubmissionSchema,
  type EventDetails,
  type Guest,
  type RsvpGroupResponse,
} from '@shared/schemas/rsvp'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = String(context.params.code ?? '')
  if (!code) return jsonError(400, 'Missing invite code')
  const db = getDb(context.env.DB)

  // Invite codes live on the guest row.
  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) return jsonError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', leaderId)
    .executeTakeFirst()
  if (!leader) return jsonError(404, 'Party leader not found')

  // All party members: leader + anyone pointing to leader.
  const members = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', '=', leaderId)
    .execute()
  const allGuests = [leader, ...members]

  const invitations = await db
    .selectFrom('invitation')
    .selectAll()
    .where('guest_id', '=', leaderId)
    .execute()
  const eventIds = invitations.map((i) => i.event_id)

  const events = eventIds.length
    ? await db
        .selectFrom('event')
        .selectAll()
        .where('id', 'in', eventIds)
        .orderBy('sort_order')
        .execute()
    : []

  const mealOptions = eventIds.length
    ? await db
        .selectFrom('meal_option')
        .selectAll()
        .where('event_id', 'in', eventIds)
        .execute()
    : []

  const guestIds = allGuests.map((g) => g.id)
  const rsvps = guestIds.length
    ? await db
        .selectFrom('rsvp')
        .selectAll()
        .where('guest_id', 'in', guestIds)
        .execute()
    : []

  const eventResponse: EventDetails[] = events.map((e) => ({
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
    invitedGuestIds: guestIds,
    mealOptions: mealOptions
      .filter((m) => m.event_id === e.id)
      .map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
      })),
  }))

  function parseNotesJson(raw: string | null) {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const guestResponse: Guest[] = allGuests.map((g) => ({
    id: g.id,
    firstName: g.first_name,
    lastName: g.last_name,
    displayName: g.display_name,
    email: g.email,
    phone: g.phone,
    inviteCode: g.invite_code,
    dietaryRestrictions: g.dietary_restrictions,
    notes: g.notes,
    notesJson: parseNotesJson(g.notes_json),
  }))

  const body: RsvpGroupResponse = {
    group: {
      id: leaderId,
      label: leader.group_label ?? '',
    },
    actingGuestId: actingGuest.id,
    guests: guestResponse,
    events: eventResponse,
    rsvps: rsvps.map((r) => ({
      guestId: r.guest_id,
      eventId: r.event_id,
      status: r.status,
      mealChoiceId: r.meal_choice_id,
      respondedAt: r.responded_at,
    })),
  }
  return Response.json(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const code = String(context.params.code ?? '')
  if (!code) return jsonError(400, 'Missing invite code')

  const parsed = await parseJson(context.request, rsvpSubmissionSchema)
  if ('error' in parsed) return parsed.error
  const submission = parsed.data

  const db = getDb(context.env.DB)
  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) return jsonError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const partyGuests = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([
        eb('id', '=', leaderId),
        eb('party_leader_id', '=', leaderId),
      ]),
    )
    .execute()
  const allowedGuestIds = new Set(partyGuests.map((g) => g.id))

  if (!allowedGuestIds.has(submission.respondedByGuestId)) {
    return jsonError(403, 'respondedByGuestId is not in this group')
  }

  const invitations = await db
    .selectFrom('invitation')
    .select(['id', 'event_id'])
    .where('guest_id', '=', leaderId)
    .execute()
  const invitedEventIds = new Set(invitations.map((i) => i.event_id))

  const eventIds = invitations.map((i) => i.event_id)
  const mealOptions = eventIds.length
    ? await db
        .selectFrom('meal_option')
        .select(['id', 'event_id'])
        .where('event_id', 'in', eventIds)
        .execute()
    : []
  const mealEventByMealId = new Map(mealOptions.map((m) => [m.id, m.event_id]))

  for (const r of submission.rsvps) {
    if (!allowedGuestIds.has(r.guestId)) {
      return jsonError(403, `Guest ${r.guestId} is not in this group`)
    }
    if (!invitedEventIds.has(r.eventId)) {
      return jsonError(403, `Group is not invited to event ${r.eventId}`)
    }
    if (r.mealChoiceId) {
      const mealEvent = mealEventByMealId.get(r.mealChoiceId)
      if (mealEvent !== r.eventId) {
        return jsonError(
          400,
          `Meal choice ${r.mealChoiceId} does not belong to event ${r.eventId}`,
        )
      }
    }
  }

  const now = nowIso()

  for (const r of submission.rsvps) {
    await db
      .insertInto('rsvp')
      .values({
        id: newId('rsvp'),
        guest_id: r.guestId,
        event_id: r.eventId,
        status: r.status,
        meal_choice_id: r.mealChoiceId ?? null,
        responded_at: now,
        responded_by_guest_id: submission.respondedByGuestId,
      })
      .onConflict((oc) =>
        oc.columns(['guest_id', 'event_id']).doUpdateSet({
          status: r.status,
          meal_choice_id: r.mealChoiceId ?? null,
          responded_at: now,
          responded_by_guest_id: submission.respondedByGuestId,
        }),
      )
      .execute()
  }

  for (const update of submission.guestUpdates ?? []) {
    if (!allowedGuestIds.has(update.guestId)) continue
    await db
      .updateTable('guest')
      .set({
        dietary_restrictions: update.dietaryRestrictions ?? null,
        notes: update.notes ?? null,
        notes_json: update.notesJson ? JSON.stringify(update.notesJson) : null,
        updated_at: now,
      })
      .where('id', '=', update.guestId)
      .execute()
  }

  // Update leader's updated_at as a group-level timestamp.
  await db
    .updateTable('guest')
    .set({ updated_at: now })
    .where('id', '=', leaderId)
    .execute()

  return Response.json({ ok: true, respondedAt: now })
}
