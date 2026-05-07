'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  newId,
  newInviteCode,
  nowIso,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  adminGroupInputSchema,
  type AdminGroupInput,
  type AdminGroupListItem,
  type AdminGuestEventStatus,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function listGroups(): Promise<{
  groups: AdminGroupListItem[]
}> {
  const db = getDbConn()

  const leaders = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', 'is', null)
    .orderBy('group_label')
    .execute()
  if (leaders.length === 0) {
    return { groups: [] }
  }
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

  const latestRsvps = await latestRsvpResponses(db, { guestIds: allGuestIds })
  const latestGuests = await latestGuestResponses(db, { guestIds: allGuestIds })
  const latestRsvpKey = (g: string, e: string) => `${g}::${e}`
  const latestRsvpMap = new Map(
    latestRsvps.map((r) => [latestRsvpKey(r.guestId, r.eventId), r])
  )
  const latestGuestMap = new Map(latestGuests.map((r) => [r.guestId, r]))

  const items: AdminGroupListItem[] = leaders.map((leader) => {
    const groupMembers = members.filter((m) => m.party_leader_id === leader.id)
    const allGroupGuests = [
      {
        id: leader.id,
        display_name: leader.display_name,
        email: leader.email,
        invite_code: leader.invite_code,
      },
      ...groupMembers,
    ]
    const groupGuestIds = new Set(allGroupGuests.map((g) => g.id))
    const groupRsvps = latestRsvps.filter((r) => groupGuestIds.has(r.guestId))
    const groupInvitations = invitations.filter((i) => i.guest_id === leader.id)

    return {
      id: leader.id,
      label: leader.group_label ?? '',
      guestCount: allGroupGuests.length,
      attendingCount: groupRsvps.filter((r) => r.status === 'attending').length,
      declinedCount: groupRsvps.filter((r) => r.status === 'declined').length,
      pendingCount:
        allGroupGuests.length * groupInvitations.length - groupRsvps.length,
      updatedAt: leader.updated_at,
      guests: allGroupGuests.map((gst) => {
        const eventStatuses: AdminGuestEventStatus[] = []
        for (const inv of groupInvitations) {
          const r = latestRsvpMap.get(latestRsvpKey(gst.id, inv.event_id))
          eventStatuses.push({
            eventId: inv.event_id,
            status: r?.status ?? 'pending',
            notesJson: parseNotesJson(r?.notesJson ?? null),
          })
        }
        const lg = latestGuestMap.get(gst.id)
        return {
          id: gst.id,
          displayName: gst.display_name,
          email: gst.email,
          inviteCode: gst.invite_code ?? '',
          notes: lg?.notes ?? null,
          notesJson: parseNotesJson(lg?.notesJson ?? null),
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
  if (!parsed.success) throw new RscFunctionError(400, 'Invalid group data')
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
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .where('party_leader_id', 'is', null)
    .executeTakeFirst()
  if (!leader) throw new RscFunctionError(404, 'Not found')

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
    invitedEventIds: invitations.map((i) => i.event_id),
    guests: allGuests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      email: g.email,
      phone: g.phone,
    })),
  }
}

export async function deleteGroup(id: string): Promise<{ ok: true }> {
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('guest').where('id', '=', id).execute()
  return { ok: true }
}
