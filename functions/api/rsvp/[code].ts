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

  const group = await db
    .selectFrom('guest_group')
    .selectAll()
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!group) return jsonError(404, 'Invite code not found')

  const guests = await db
    .selectFrom('guest')
    .selectAll()
    .where('guest_group_id', '=', group.id)
    .execute()

  const invitations = await db
    .selectFrom('invitation')
    .selectAll()
    .where('guest_group_id', '=', group.id)
    .execute()
  const invitationIds = invitations.map((i) => i.id)
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

  const invitationGuests = invitationIds.length
    ? await db
        .selectFrom('invitation_guest')
        .selectAll()
        .where('invitation_id', 'in', invitationIds)
        .execute()
    : []

  const guestIds = guests.map((g) => g.id)
  const rsvps = guestIds.length
    ? await db
        .selectFrom('rsvp')
        .selectAll()
        .where('guest_id', 'in', guestIds)
        .execute()
    : []

  const songRequests = guestIds.length
    ? await db
        .selectFrom('song_request')
        .selectAll()
        .where('guest_id', 'in', guestIds)
        .execute()
    : []

  const eventResponse: EventDetails[] = events.map((e) => {
    const invitation = invitations.find((inv) => inv.event_id === e.id)
    const explicitInvitedGuestIds = invitation
      ? invitationGuests
          .filter((ig) => ig.invitation_id === invitation.id)
          .map((ig) => ig.guest_id)
      : []
    const invitedGuestIds =
      explicitInvitedGuestIds.length > 0
        ? explicitInvitedGuestIds
        : guestIds.slice()
    return {
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
      invitedGuestIds,
      mealOptions: mealOptions
        .filter((m) => m.event_id === e.id)
        .map((m) => ({
          id: m.id,
          label: m.label,
          description: m.description,
        })),
    }
  })

  const guestResponse: Guest[] = guests.map((g) => ({
    id: g.id,
    firstName: g.first_name,
    lastName: g.last_name,
    displayName: g.display_name,
    email: g.email,
    phone: g.phone,
    dietaryRestrictions: g.dietary_restrictions,
    notes: g.notes,
  }))

  const body: RsvpGroupResponse = {
    group: {
      id: group.id,
      label: group.label,
      inviteCode: group.invite_code,
    },
    guests: guestResponse,
    events: eventResponse,
    rsvps: rsvps.map((r) => ({
      guestId: r.guest_id,
      eventId: r.event_id,
      status: r.status,
      mealChoiceId: r.meal_choice_id,
      respondedAt: r.responded_at,
    })),
    songRequests: songRequests.map((s) => ({
      id: s.id,
      guestId: s.guest_id,
      title: s.title,
      artist: s.artist,
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
  const group = await db
    .selectFrom('guest_group')
    .select(['id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!group) return jsonError(404, 'Invite code not found')

  const groupGuests = await db
    .selectFrom('guest')
    .select(['id'])
    .where('guest_group_id', '=', group.id)
    .execute()
  const allowedGuestIds = new Set(groupGuests.map((g) => g.id))

  if (!allowedGuestIds.has(submission.respondedByGuestId)) {
    return jsonError(403, 'respondedByGuestId is not in this group')
  }

  // Pull invitations for this group (+ per-guest subsets, if any) and meal
  // options, so we can validate that every submitted rsvp targets an event
  // the group was actually invited to, a guest allowed at that event, and a
  // meal option that belongs to that event.
  const invitations = await db
    .selectFrom('invitation')
    .select(['id', 'event_id'])
    .where('guest_group_id', '=', group.id)
    .execute()
  const invitationByEventId = new Map(invitations.map((i) => [i.event_id, i]))
  const invitationIds = invitations.map((i) => i.id)
  const invitationGuests = invitationIds.length
    ? await db
        .selectFrom('invitation_guest')
        .select(['invitation_id', 'guest_id'])
        .where('invitation_id', 'in', invitationIds)
        .execute()
    : []
  const guestSubsetByInvitationId = new Map<string, Set<string>>()
  for (const ig of invitationGuests) {
    const set = guestSubsetByInvitationId.get(ig.invitation_id) ?? new Set()
    set.add(ig.guest_id)
    guestSubsetByInvitationId.set(ig.invitation_id, set)
  }

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
    const invitation = invitationByEventId.get(r.eventId)
    if (!invitation) {
      return jsonError(403, `Group is not invited to event ${r.eventId}`)
    }
    const subset = guestSubsetByInvitationId.get(invitation.id)
    if (subset && !subset.has(r.guestId)) {
      return jsonError(403, `Guest ${r.guestId} is not invited to event ${r.eventId}`)
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

  // Upsert RSVPs row-by-row. D1 supports onConflict.
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
        updated_at: now,
      })
      .where('id', '=', update.guestId)
      .execute()
  }

  // Replace song requests for any guest that submitted them this round.
  const songRequests = submission.songRequests ?? []
  const songGuestIds = [...new Set(songRequests.map((s) => s.guestId))]
  for (const gid of songGuestIds) {
    if (!allowedGuestIds.has(gid)) continue
    await db.deleteFrom('song_request').where('guest_id', '=', gid).execute()
  }
  for (const s of songRequests) {
    if (!allowedGuestIds.has(s.guestId)) continue
    await db
      .insertInto('song_request')
      .values({
        id: newId('song'),
        guest_id: s.guestId,
        title: s.title,
        artist: s.artist ?? null,
        created_at: now,
      })
      .execute()
  }

  await db
    .updateTable('guest_group')
    .set({ updated_at: now })
    .where('id', '=', group.id)
    .execute()

  return Response.json({ ok: true, respondedAt: now })
}
