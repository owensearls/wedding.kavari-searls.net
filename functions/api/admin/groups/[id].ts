import { getDb, type Env } from '../../../lib/db'
import { jsonError } from '../../../lib/responses'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)

  // id is the party leader's guest id.
  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .where('party_leader_id', 'is', null)
    .executeTakeFirst()
  if (!leader) return jsonError(404, 'Not found')

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

  return Response.json({
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
  })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)
  // Deleting the leader cascades to members (via party_leader_id FK),
  // invitations (via guest_id FK), and RSVPs.
  await db.deleteFrom('guest').where('id', '=', id).execute()
  return Response.json({ ok: true })
}
