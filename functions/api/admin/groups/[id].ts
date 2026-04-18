import { getDb, type Env } from '../../../lib/db'
import { jsonError } from '../../../lib/responses'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)

  const group = await db
    .selectFrom('guest_group')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!group) return jsonError(404, 'Not found')

  const guests = await db
    .selectFrom('guest')
    .selectAll()
    .where('guest_group_id', '=', id)
    .execute()
  const invitations = await db
    .selectFrom('invitation')
    .select(['event_id'])
    .where('guest_group_id', '=', id)
    .execute()

  return Response.json({
    id: group.id,
    label: group.label,
    inviteCode: group.invite_code,
    notes: group.notes,
    invitedEventIds: invitations.map((i) => i.event_id),
    guests: guests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      email: g.email,
      phone: g.phone,
      dietaryRestrictions: g.dietary_restrictions,
      notes: g.notes,
    })),
  })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = String(context.params.id ?? '')
  if (!id) return jsonError(400, 'Missing id')
  const db = getDb(context.env.DB)
  await db.deleteFrom('guest_group').where('id', '=', id).execute()
  return Response.json({ ok: true })
}
