import { getDb, type Env } from '../../lib/db'
import { jsonError } from '../../lib/responses'
import { score } from '../../lib/fuzzy'
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

  const candidates = await db
    .selectFrom('guest')
    .innerJoin('guest_group', 'guest_group.id', 'guest.guest_group_id')
    .select([
      'guest.id as guestId',
      'guest.display_name as displayName',
      'guest.email as email',
      'guest.first_name as firstName',
      'guest.last_name as lastName',
      'guest_group.id as groupId',
      'guest_group.label as groupLabel',
      'guest_group.invite_code as inviteCode',
    ])
    .execute()

  const scoredByGroup = new Map<
    string,
    {
      groupId: string
      groupLabel: string
      inviteCode: string
      score: number
      guestNames: Set<string>
    }
  >()

  for (const row of candidates) {
    const fullName =
      `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || row.displayName
    const candidateText = [row.displayName, fullName, row.email]
      .filter(Boolean)
      .join(' ')
    const s = score(query, candidateText)
    if (s <= 0) continue

    const existing = scoredByGroup.get(row.groupId)
    if (existing) {
      existing.score = Math.max(existing.score, s)
      existing.guestNames.add(row.displayName)
    } else {
      scoredByGroup.set(row.groupId, {
        groupId: row.groupId,
        groupLabel: row.groupLabel,
        inviteCode: row.inviteCode,
        score: s,
        guestNames: new Set([row.displayName]),
      })
    }
  }

  const matches = [...scoredByGroup.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((m) => ({
      guestGroupId: m.groupId,
      inviteCode: m.inviteCode,
      label: m.groupLabel,
      guestNames: [...m.guestNames],
    }))

  const body: LookupResponse = { matches }
  return Response.json(body)
}
