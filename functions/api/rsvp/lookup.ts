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

  const rows = await db
    .selectFrom('guest')
    .innerJoin('guest_group', 'guest_group.id', 'guest.guest_group_id')
    .select([
      'guest.id as guestId',
      'guest.display_name as displayName',
      'guest.email as email',
      'guest.first_name as firstName',
      'guest.last_name as lastName',
      'guest.invite_code as inviteCode',
      'guest_group.id as groupId',
      'guest_group.label as groupLabel',
    ])
    .execute()

  const body: LookupResponse = {
    matches: aggregateLookupMatches(rows, query),
  }
  return Response.json(body)
}
