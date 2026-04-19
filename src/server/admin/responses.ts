'use server'

import { getEnv } from '../context'
import { getDb } from '../lib/db'
import type { AdminResponseRow } from '@shared/schemas/admin'

function getDbConn() {
  return getDb(getEnv().DB)
}

export async function listResponses(): Promise<{ rows: AdminResponseRow[] }> {
  const db = getDbConn()

  const guests = await db
    .selectFrom('guest')
    .select([
      'id as guestId',
      'display_name as guestName',
      'invite_code as inviteCode',
      'dietary_restrictions as dietary',
      'party_leader_id as partyLeaderId',
      'group_label as groupLabel',
    ])
    .execute()

  const events = await db
    .selectFrom('event')
    .select(['id', 'name', 'sort_order'])
    .orderBy('sort_order')
    .execute()
  const eventById = new Map(events.map((e) => [e.id, e]))

  const invitations = await db
    .selectFrom('invitation')
    .select(['guest_id', 'event_id'])
    .execute()

  const rsvps = await db
    .selectFrom('rsvp')
    .leftJoin('meal_option', 'meal_option.id', 'rsvp.meal_choice_id')
    .select([
      'rsvp.guest_id as guestId',
      'rsvp.event_id as eventId',
      'rsvp.status as status',
      'rsvp.responded_at as respondedAt',
      'meal_option.label as mealLabel',
    ])
    .execute()

  const rsvpKey = (gid: string, eid: string) => `${gid}::${eid}`
  const rsvpMap = new Map(rsvps.map((r) => [rsvpKey(r.guestId, r.eventId), r]))

  const out: AdminResponseRow[] = []
  for (const g of guests) {
    const leaderId = g.partyLeaderId ?? g.guestId
    const eventIdsForGroup = invitations
      .filter((i) => i.guest_id === leaderId)
      .map((i) => i.event_id)
    for (const eid of eventIdsForGroup) {
      const ev = eventById.get(eid)
      if (!ev) continue
      const r = rsvpMap.get(rsvpKey(g.guestId, eid))
      out.push({
        groupLabel: g.groupLabel ?? '',
        inviteCode: g.inviteCode,
        guestName: g.guestName,
        eventName: ev.name,
        status: r?.status ?? 'pending',
        mealLabel: r?.mealLabel ?? null,
        dietaryRestrictions: g.dietary,
        respondedAt: r?.respondedAt ?? null,
      })
    }
  }

  return { rows: out }
}
