import { getDb, type Env } from '../../../lib/db'
import { jsonError } from '../../../lib/responses'
import type { AdminGuestDetail } from '@shared/schemas/admin'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)

  const guest = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!guest) return jsonError(404, 'Guest not found')

  // Resolve group label: use own group_label (should always be set), or
  // fall back to leader's group_label for safety.
  let groupLabel = guest.group_label ?? ''
  const leaderId = guest.party_leader_id ?? guest.id

  if (!groupLabel && guest.party_leader_id) {
    const leader = await db
      .selectFrom('guest')
      .select(['group_label'])
      .where('id', '=', guest.party_leader_id)
      .executeTakeFirst()
    groupLabel = leader?.group_label ?? ''
  }

  // Events the party is invited to.
  const invitations = await db
    .selectFrom('invitation')
    .innerJoin('event', 'event.id', 'invitation.event_id')
    .select([
      'invitation.id as invitationId',
      'invitation.event_id as eventId',
      'event.name as eventName',
      'event.sort_order as sortOrder',
    ])
    .where('invitation.guest_id', '=', leaderId)
    .orderBy('event.sort_order')
    .execute()

  const rsvps = await db
    .selectFrom('rsvp')
    .leftJoin('meal_option', 'meal_option.id', 'rsvp.meal_choice_id')
    .leftJoin('guest as responder', 'responder.id', 'rsvp.responded_by_guest_id')
    .select([
      'rsvp.event_id as eventId',
      'rsvp.status as status',
      'rsvp.responded_at as respondedAt',
      'meal_option.label as mealLabel',
      'responder.display_name as respondedByDisplayName',
    ])
    .where('rsvp.guest_id', '=', id)
    .execute()

  function parseNotesJson(raw: string | null) {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const events: AdminGuestDetail['events'] = invitations.map((inv) => {
    const rsvp = rsvps.find((r) => r.eventId === inv.eventId)
    return {
      eventId: inv.eventId,
      eventName: inv.eventName,
      status: rsvp?.status ?? 'pending',
      mealLabel: rsvp?.mealLabel ?? null,
      respondedAt: rsvp?.respondedAt ?? null,
      respondedByDisplayName: rsvp?.respondedByDisplayName ?? null,
    }
  })

  const body: AdminGuestDetail = {
    id: guest.id,
    displayName: guest.display_name,
    email: guest.email,
    phone: guest.phone,
    inviteCode: guest.invite_code,
    dietaryRestrictions: guest.dietary_restrictions,
    notes: guest.notes,
    notesJson: parseNotesJson(guest.notes_json),
    groupLabel,
    events,
  }
  return Response.json(body)
}
