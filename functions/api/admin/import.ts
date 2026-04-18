import { getDb, newId, newInviteCode, nowIso, type Env } from '../../lib/db'
import { parseJson } from '../../lib/responses'
import { adminImportSchema } from '@shared/schemas/admin'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const parsed = await parseJson(context.request, adminImportSchema)
  if ('error' in parsed) return parsed.error

  const db = getDb(context.env.DB)
  const events = await db.selectFrom('event').select(['id', 'slug']).execute()
  const eventBySlug = new Map(events.map((e) => [e.slug, e.id]))

  const groupedByLabel = new Map<string, typeof parsed.data.rows>()
  for (const row of parsed.data.rows) {
    const arr = groupedByLabel.get(row.groupLabel) ?? []
    arr.push(row)
    groupedByLabel.set(row.groupLabel, arr)
  }

  const now = nowIso()
  const created: {
    groupId: string
    label: string
    guests: { id: string; displayName: string; inviteCode: string }[]
  }[] = []
  const skipped: string[] = []

  for (const [label, rows] of groupedByLabel) {
    // Skip if a leader with this group_label already exists.
    const existing = await db
      .selectFrom('guest')
      .select(['id'])
      .where('group_label', '=', label)
      .where('party_leader_id', 'is', null)
      .executeTakeFirst()
    if (existing) {
      skipped.push(label)
      continue
    }

    const eventIdsForGroup = new Set<string>()
    const createdGuests: {
      id: string
      displayName: string
      inviteCode: string
    }[] = []

    let leaderId: string | null = null

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const id = newId('gst')
      const displayName = `${row.firstName}${row.lastName ? ' ' + row.lastName : ''}`
      const inviteCode = newInviteCode()
      const isLeader = i === 0

      if (isLeader) leaderId = id

      await db
        .insertInto('guest')
        .values({
          id,
          party_leader_id: isLeader ? null : leaderId,
          first_name: row.firstName,
          last_name: row.lastName ?? null,
          display_name: displayName,
          email: row.email && row.email.length ? row.email : null,
          phone: row.phone ?? null,
          invite_code: inviteCode,
          group_label: label,
          dietary_restrictions: null,
          notes: null,
          notes_json: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
      createdGuests.push({ id, displayName, inviteCode })

      if (row.events) {
        for (const slug of row.events
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          const eid = eventBySlug.get(slug)
          if (eid) eventIdsForGroup.add(eid)
        }
      }
    }

    for (const eventId of eventIdsForGroup) {
      await db
        .insertInto('invitation')
        .values({
          id: newId('inv'),
          guest_id: leaderId!,
          event_id: eventId,
        })
        .execute()
    }

    created.push({ groupId: leaderId!, label, guests: createdGuests })
  }

  return Response.json({ created, skipped })
}
