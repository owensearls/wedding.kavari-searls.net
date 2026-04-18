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
    const existing = await db
      .selectFrom('guest_group')
      .select(['id'])
      .where('label', '=', label)
      .executeTakeFirst()
    if (existing) {
      skipped.push(label)
      continue
    }

    const groupId = newId('grp')
    await db
      .insertInto('guest_group')
      .values({
        id: groupId,
        label,
        primary_contact_guest_id: null,
        notes: null,
        created_at: now,
        updated_at: now,
      })
      .execute()

    const eventIdsForGroup = new Set<string>()
    const createdGuests: {
      id: string
      displayName: string
      inviteCode: string
    }[] = []
    for (const row of rows) {
      const id = newId('gst')
      const displayName = `${row.firstName}${row.lastName ? ' ' + row.lastName : ''}`
      const inviteCode = newInviteCode()
      await db
        .insertInto('guest')
        .values({
          id,
          guest_group_id: groupId,
          first_name: row.firstName,
          last_name: row.lastName ?? null,
          display_name: displayName,
          email: row.email && row.email.length ? row.email : null,
          phone: row.phone ?? null,
          invite_code: inviteCode,
          is_plus_one: 0,
          dietary_restrictions: null,
          notes: null,
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
          guest_group_id: groupId,
          event_id: eventId,
        })
        .execute()
    }

    created.push({ groupId, label, guests: createdGuests })
  }

  return Response.json({ created, skipped })
}
