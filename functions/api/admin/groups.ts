import { getDb, newId, newInviteCode, nowIso, type Env } from '../../lib/db'
import { parseJson } from '../../lib/responses'
import {
  adminGroupInputSchema,
  type AdminGroupListItem,
  type AdminGuestEventStatus,
} from '@shared/schemas/admin'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = getDb(context.env.DB)
  const groups = await db
    .selectFrom('guest_group')
    .selectAll()
    .orderBy('label')
    .execute()
  if (groups.length === 0) return Response.json({ groups: [] })

  const groupIds = groups.map((g) => g.id)
  const guests = await db
    .selectFrom('guest')
    .select([
      'id',
      'guest_group_id',
      'display_name',
      'email',
      'first_name',
      'last_name',
      'invite_code',
      'dietary_restrictions',
      'notes',
    ])
    .where('guest_group_id', 'in', groupIds)
    .orderBy('guest.first_name')
    .execute()

  const invitations = await db
    .selectFrom('invitation')
    .select(['id', 'guest_group_id', 'event_id'])
    .where('guest_group_id', 'in', groupIds)
    .execute()
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

  const rsvps = await db
    .selectFrom('rsvp')
    .innerJoin('guest', 'guest.id', 'rsvp.guest_id')
    .leftJoin('meal_option', 'meal_option.id', 'rsvp.meal_choice_id')
    .select([
      'guest.guest_group_id as groupId',
      'rsvp.guest_id as guestId',
      'rsvp.event_id as eventId',
      'rsvp.status as status',
      'meal_option.label as mealLabel',
    ])
    .where('guest.guest_group_id', 'in', groupIds)
    .execute()

  const items: AdminGroupListItem[] = groups.map((g) => {
    const groupGuests = guests.filter((x) => x.guest_group_id === g.id)
    const groupRsvps = rsvps.filter((r) => r.groupId === g.id)
    const groupInvitations = invitations.filter(
      (i) => i.guest_group_id === g.id,
    )

    return {
      id: g.id,
      label: g.label,
      guestCount: groupGuests.length,
      attendingCount: groupRsvps.filter((r) => r.status === 'attending').length,
      declinedCount: groupRsvps.filter((r) => r.status === 'declined').length,
      pendingCount: groupRsvps.filter((r) => r.status === 'pending').length,
      updatedAt: g.updated_at,
      guests: groupGuests.map((gst) => {
        const eventStatuses: AdminGuestEventStatus[] = []
        for (const inv of groupInvitations) {
          const subset = guestSubsetByInvitationId.get(inv.id)
          const isInvited = !subset || subset.has(gst.id)
          if (!isInvited) {
            eventStatuses.push({
              eventId: inv.event_id,
              status: 'not-invited',
              mealLabel: null,
            })
            continue
          }
          const rsvp = groupRsvps.find(
            (r) => r.guestId === gst.id && r.eventId === inv.event_id,
          )
          eventStatuses.push({
            eventId: inv.event_id,
            status: rsvp?.status ?? 'pending',
            mealLabel: rsvp?.mealLabel ?? null,
          })
        }
        return {
          id: gst.id,
          displayName: gst.display_name,
          email: gst.email,
          inviteCode: gst.invite_code,
          dietaryRestrictions: gst.dietary_restrictions,
          notes: gst.notes,
          eventStatuses,
        }
      }),
    }
  })
  return Response.json({ groups: items })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const parsed = await parseJson(context.request, adminGroupInputSchema)
  if ('error' in parsed) return parsed.error
  const input = parsed.data

  const db = getDb(context.env.DB)
  const now = nowIso()
  const groupId = input.id ?? newId('grp')

  if (input.id) {
    await db
      .updateTable('guest_group')
      .set({
        label: input.label,
        notes: input.notes ?? null,
        updated_at: now,
      })
      .where('id', '=', input.id)
      .execute()
  } else {
    await db
      .insertInto('guest_group')
      .values({
        id: groupId,
        label: input.label,
        primary_contact_guest_id: null,
        notes: input.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }

  // Replace guests + invitations to keep this endpoint idempotent.
  const existingGuests = await db
    .selectFrom('guest')
    .select(['id'])
    .where('guest_group_id', '=', groupId)
    .execute()
  const submittedIds = new Set(
    input.guests.map((g) => g.id).filter((x): x is string => !!x),
  )
  for (const eg of existingGuests) {
    if (!submittedIds.has(eg.id)) {
      await db.deleteFrom('guest').where('id', '=', eg.id).execute()
    }
  }

  for (const g of input.guests) {
    const id = g.id ?? newId('gst')
    const displayName = `${g.firstName}${g.lastName ? ' ' + g.lastName : ''}`
    if (g.id) {
      await db
        .updateTable('guest')
        .set({
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          is_plus_one: 0,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          updated_at: now,
        })
        .where('id', '=', g.id)
        .execute()
    } else {
      await db
        .insertInto('guest')
        .values({
          id,
          guest_group_id: groupId,
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          invite_code: newInviteCode(),
          is_plus_one: 0,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  // Reset invitations to match the input set.
  await db.deleteFrom('invitation').where('guest_group_id', '=', groupId).execute()
  for (const eventId of input.invitedEventIds ?? []) {
    await db
      .insertInto('invitation')
      .values({
        id: newId('inv'),
        guest_group_id: groupId,
        event_id: eventId,
      })
      .execute()
  }

  return Response.json({ id: groupId })
}
