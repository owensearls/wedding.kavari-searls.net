import { getDb, type Env } from '../../../lib/db'
import { jsonError } from '../../../lib/responses'
import type { AdminGuestDetail } from '@shared/schemas/admin'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)

  const guest = await db
    .selectFrom('guest')
    .innerJoin('guest_group', 'guest_group.id', 'guest.guest_group_id')
    .select([
      'guest.id as id',
      'guest.display_name as displayName',
      'guest.email as email',
      'guest.phone as phone',
      'guest.invite_code as inviteCode',
      'guest.dietary_restrictions as dietaryRestrictions',
      'guest.notes as notes',
      'guest.guest_group_id as groupId',
      'guest_group.label as groupLabel',
    ])
    .where('guest.id', '=', id)
    .executeTakeFirst()
  if (!guest) return jsonError(404, 'Guest not found')

  // Events the group is invited to, the guest-level subset (when set), and
  // any submitted RSVP rows.
  const invitations = await db
    .selectFrom('invitation')
    .innerJoin('event', 'event.id', 'invitation.event_id')
    .select([
      'invitation.id as invitationId',
      'invitation.event_id as eventId',
      'event.name as eventName',
      'event.sort_order as sortOrder',
    ])
    .where('invitation.guest_group_id', '=', guest.groupId)
    .orderBy('event.sort_order')
    .execute()

  const invitationIds = invitations.map((i) => i.invitationId)
  const invitationGuests = invitationIds.length
    ? await db
        .selectFrom('invitation_guest')
        .select(['invitation_id', 'guest_id'])
        .where('invitation_id', 'in', invitationIds)
        .execute()
    : []
  const guestsByInvitation = new Map<string, Set<string>>()
  for (const ig of invitationGuests) {
    const set = guestsByInvitation.get(ig.invitation_id) ?? new Set()
    set.add(ig.guest_id)
    guestsByInvitation.set(ig.invitation_id, set)
  }

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

  const songRequests = await db
    .selectFrom('song_request')
    .select(['id', 'title', 'artist'])
    .where('guest_id', '=', id)
    .execute()

  const events: AdminGuestDetail['events'] = invitations.map((inv) => {
    const subset = guestsByInvitation.get(inv.invitationId)
    const invited = !subset || subset.has(id)
    if (!invited) {
      return {
        eventId: inv.eventId,
        eventName: inv.eventName,
        status: 'not-invited',
        mealLabel: null,
        respondedAt: null,
        respondedByDisplayName: null,
      }
    }
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
    displayName: guest.displayName,
    email: guest.email,
    phone: guest.phone,
    inviteCode: guest.inviteCode,
    dietaryRestrictions: guest.dietaryRestrictions,
    notes: guest.notes,
    groupLabel: guest.groupLabel,
    events,
    songRequests: songRequests.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
    })),
  }
  return Response.json(body)
}
