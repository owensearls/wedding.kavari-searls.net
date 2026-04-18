import { getDb, type Env } from '../../lib/db'
import { jsonError } from '../../lib/responses'
import { aggregateLookupMatches } from '../../lib/fuzzy'
import { lookupQuerySchema, type LookupResponse } from '@shared/schemas/rsvp'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const parsed = lookupQuerySchema.safeParse({
    query: url.searchParams.get('query') ?? '',
  })
  if (!parsed.success) {
    return jsonError(400, 'Missing or invalid query parameter')
  }
  const { query } = parsed.data

  const db = getDb(context.env.DB)

  // Self-join to resolve each guest's party leader for grouping.
  const rows = await db
    .selectFrom('guest')
    .select([
      'guest.id as guestId',
      'guest.display_name as displayName',
      'guest.email as email',
      'guest.first_name as firstName',
      'guest.last_name as lastName',
      'guest.invite_code as inviteCode',
      'guest.party_leader_id as partyLeaderId',
      'guest.group_label as groupLabel',
    ])
    .execute()

  // Map into LookupCandidate shape — partyLeaderId is self for leaders.
  const candidates = rows.map((r) => ({
    guestId: r.guestId,
    displayName: r.displayName,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    inviteCode: r.inviteCode,
    partyLeaderId: r.partyLeaderId ?? r.guestId,
    groupLabel: r.groupLabel ?? '',
  }))

  const body: LookupResponse = {
    matches: aggregateLookupMatches(candidates, query),
  }
  return Response.json(body)
}
