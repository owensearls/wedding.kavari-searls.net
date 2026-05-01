'use server'

import {
  adminGroupInputSchema,
  type AdminGroupInput,
  type AdminGroupListItem,
  type AdminGuestEventStatus,
} from 'schema/admin'
import { getDb, newId, newInviteCode, nowIso } from 'db'
import { getEnv } from 'db/context'

function getDbConn() {
  return getDb(getEnv().DB)
}

export async function listGroups(): Promise<{ groups: AdminGroupListItem[] }> {
  const db = getDbConn()

  const leaders = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', 'is', null)
    .orderBy('group_label')
    .execute()
  if (leaders.length === 0) return { groups: [] }

  const leaderIds = leaders.map((l) => l.id)

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

  const allGuestIds = [...leaderIds, ...members.map((m) => m.id)]

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
    const groupMembers = members.filter((m) => m.party_leader_id === leader.id)
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
    const groupInvitations = invitations.filter((i) => i.guest_id === leader.id)

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
            (r) => r.guestId === gst.id && r.eventId === inv.event_id
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
  return { groups: items }
}

export async function saveGroup(
  input: AdminGroupInput
): Promise<{ id: string }> {
  const parsed = adminGroupInputSchema.safeParse(input)
  if (!parsed.success) throw new Error('Invalid group data')
  const data = parsed.data

  const db = getDbConn()
  const now = nowIso()

  const leaderId = data.id ?? newId('gst')
  const isUpdate = !!data.id

  if (isUpdate) {
    await db
      .updateTable('guest')
      .set({
        group_label: data.label,
        notes: data.notes ?? null,
        updated_at: now,
      })
      .where('id', '=', leaderId)
      .execute()
  } else {
    const first = data.guests[0]
    const displayName = `${first.firstName}${first.lastName ? ` ${first.lastName}` : ''}`
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
        group_label: data.label,
        dietary_restrictions: first.dietaryRestrictions ?? null,
        notes: first.notes ?? null,
        notes_json: null,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }

  const existingMembers = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([eb('id', '=', leaderId), eb('party_leader_id', '=', leaderId)])
    )
    .execute()
  const submittedIds = new Set(
    data.guests.map((g) => g.id).filter((x): x is string => !!x)
  )
  if (!isUpdate) submittedIds.add(leaderId)
  for (const eg of existingMembers) {
    if (!submittedIds.has(eg.id)) {
      await db.deleteFrom('guest').where('id', '=', eg.id).execute()
    }
  }

  for (let i = 0; i < data.guests.length; i++) {
    const g = data.guests[i]
    const isLeaderRow = isUpdate ? g.id === leaderId : i === 0
    const id = isLeaderRow ? leaderId : (g.id ?? newId('gst'))
    const displayName = `${g.firstName}${g.lastName ? ` ${g.lastName}` : ''}`

    if (g.id && submittedIds.has(g.id)) {
      await db
        .updateTable('guest')
        .set({
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          group_label: data.label,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          updated_at: now,
        })
        .where('id', '=', g.id)
        .execute()
    } else if (!isLeaderRow) {
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
          group_label: data.label,
          dietary_restrictions: g.dietaryRestrictions ?? null,
          notes: g.notes ?? null,
          notes_json: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  await db.deleteFrom('invitation').where('guest_id', '=', leaderId).execute()
  for (const eventId of data.invitedEventIds ?? []) {
    await db
      .insertInto('invitation')
      .values({
        id: newId('inv'),
        guest_id: leaderId,
        event_id: eventId,
      })
      .execute()
  }

  return { id: leaderId }
}

export async function getGroup(
  id: string
): Promise<AdminGroupInput & { id: string }> {
  if (!id) throw new Error('Missing id')
  const db = getDbConn()

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .where('party_leader_id', 'is', null)
    .executeTakeFirst()
  if (!leader) throw new Error('Not found')

  const members = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', '=', id)
    .execute()
  const allGuests = [leader, ...members]

  const invitations = await db
    .selectFrom('invitation')
    .select(['event_id'])
    .where('guest_id', '=', id)
    .execute()

  return {
    id: leader.id,
    label: leader.group_label ?? '',
    notes: leader.notes,
    invitedEventIds: invitations.map((i) => i.event_id),
    guests: allGuests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      email: g.email,
      phone: g.phone,
      inviteCode: g.invite_code,
      dietaryRestrictions: g.dietary_restrictions,
      notes: g.notes,
    })),
  }
}

export async function deleteGroup(id: string): Promise<{ ok: true }> {
  if (!id) throw new Error('Missing id')
  const db = getDbConn()
  await db.deleteFrom('guest').where('id', '=', id).execute()
  return { ok: true }
}
