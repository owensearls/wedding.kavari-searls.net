import { getDb, newId, newInviteCode, nowIso, type Env } from '../../lib/db'
import { parseJson } from '../../lib/responses'
import {
  adminGroupInputSchema,
  type AdminGroupListItem,
  type AdminGuestEventStatus,
} from '@shared/schemas/admin'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = getDb(context.env.DB)

  // Leaders are guests with no party_leader_id.
  const leaders = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', 'is', null)
    .orderBy('group_label')
    .execute()
  if (leaders.length === 0) return Response.json({ groups: [] })

  const leaderIds = leaders.map((l) => l.id)

  // All members (non-leaders) belonging to these leaders.
  const members = await db
    .selectFrom('guest')
    .select([
      'id',
      'party_leader_id',
      'display_name',
      'email',
      'first_name',
      'last_name',
      'invite_code',
      'dietary_restrictions',
      'notes',
    ])
    .where('party_leader_id', 'in', leaderIds)
    .orderBy('first_name')
    .execute()

  const invitations = await db
    .selectFrom('invitation')
    .select(['id', 'guest_id', 'event_id'])
    .where('guest_id', 'in', leaderIds)
    .execute()

  // All guest IDs (leaders + members) for RSVP lookup.
  const allGuestIds = [
    ...leaderIds,
    ...members.map((m) => m.id),
  ]

  const rsvps = allGuestIds.length
    ? await db
        .selectFrom('rsvp')
        .leftJoin('meal_option', 'meal_option.id', 'rsvp.meal_choice_id')
        .select([
          'rsvp.guest_id as guestId',
          'rsvp.event_id as eventId',
          'rsvp.status as status',
          'meal_option.label as mealLabel',
        ])
        .where('rsvp.guest_id', 'in', allGuestIds)
        .execute()
    : []

  const items: AdminGroupListItem[] = leaders.map((leader) => {
    const groupMembers = members.filter(
      (m) => m.party_leader_id === leader.id,
    )
    const allGroupGuests = [
      {
        id: leader.id,
        display_name: leader.display_name,
        email: leader.email,
        invite_code: leader.invite_code,
        dietary_restrictions: leader.dietary_restrictions,
        notes: leader.notes,
      },
      ...groupMembers,
    ]
    const groupGuestIds = new Set(allGroupGuests.map((g) => g.id))
    const groupRsvps = rsvps.filter((r) => groupGuestIds.has(r.guestId))
    const groupInvitations = invitations.filter(
      (i) => i.guest_id === leader.id,
    )

    return {
      id: leader.id,
      label: leader.group_label ?? '',
      guestCount: allGroupGuests.length,
      attendingCount: groupRsvps.filter((r) => r.status === 'attending').length,
      declinedCount: groupRsvps.filter((r) => r.status === 'declined').length,
      pendingCount: groupRsvps.filter((r) => r.status === 'pending').length,
      updatedAt: leader.updated_at,
      guests: allGroupGuests.map((gst) => {
        const eventStatuses: AdminGuestEventStatus[] = []
        for (const inv of groupInvitations) {
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

  // input.id is the leader guest id (if editing) or undefined (if creating).
  const leaderId = input.id ?? newId('gst')
  const isUpdate = !!input.id

  if (isUpdate) {
    // Update the leader guest.
    await db
      .updateTable('guest')
      .set({
        group_label: input.label,
        notes: input.notes ?? null,
        updated_at: now,
      })
      .where('id', '=', leaderId)
      .execute()
  } else {
    // The first guest in the array becomes the leader.
    const first = input.guests[0]
    const displayName = `${first.firstName}${first.lastName ? ' ' + first.lastName : ''}`
    await db
      .insertInto('guest')
      .values({
        id: leaderId,
        party_leader_id: null,
        first_name: first.firstName,
        last_name: first.lastName ?? null,
        display_name: displayName,
        email: first.email ? first.email : null,
        phone: first.phone ?? null,
        invite_code: newInviteCode(),
        group_label: input.label,
        dietary_restrictions: first.dietaryRestrictions ?? null,
        notes: first.notes ?? null,
        notes_json: null,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }

  // Replace guests to keep the endpoint idempotent.
  const existingMembers = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([
        eb('id', '=', leaderId),
        eb('party_leader_id', '=', leaderId),
      ]),
    )
    .execute()
  const submittedIds = new Set(
    input.guests.map((g) => g.id).filter((x): x is string => !!x),
  )
  // If creating, the leader was just inserted and its id matches leaderId.
  if (!isUpdate) submittedIds.add(leaderId)
  for (const eg of existingMembers) {
    if (!submittedIds.has(eg.id)) {
      await db.deleteFrom('guest').where('id', '=', eg.id).execute()
    }
  }

  // Upsert each guest.
  for (let i = 0; i < input.guests.length; i++) {
    const g = input.guests[i]
    const isLeaderRow = isUpdate ? g.id === leaderId : i === 0
    const id = isLeaderRow ? leaderId : (g.id ?? newId('gst'))
    const displayName = `${g.firstName}${g.lastName ? ' ' + g.lastName : ''}`

    if (g.id && submittedIds.has(g.id)) {
      // Update existing guest.
      await db
        .updateTable('guest')
        .set({
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          group_label: input.label,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          updated_at: now,
        })
        .where('id', '=', g.id)
        .execute()
    } else if (!isLeaderRow) {
      // Insert new member.
      await db
        .insertInto('guest')
        .values({
          id,
          party_leader_id: leaderId,
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          invite_code: newInviteCode(),
          group_label: input.label,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          notes_json: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
    // Leader row for new group was already inserted above.
  }

  // Reset invitations to match the input set.
  await db
    .deleteFrom('invitation')
    .where('guest_id', '=', leaderId)
    .execute()
  for (const eventId of input.invitedEventIds ?? []) {
    await db
      .insertInto('invitation')
      .values({
        id: newId('inv'),
        guest_id: leaderId,
        event_id: eventId,
      })
      .execute()
  }

  return Response.json({ id: leaderId })
}
