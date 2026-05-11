'use server'

import { getDb, newId, newInviteCode, nowIso } from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import { adminImportSchema } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export interface ImportResult {
  created: {
    groupId: string
    label: string | null
    guests: { id: string; displayName: string; inviteCode: string }[]
  }[]
  skipped: string[]
}

export async function importRows(rows: unknown[]): Promise<ImportResult> {
  const parsed = adminImportSchema.safeParse({ rows })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue.path.join('.')
    throw new RscFunctionError(
      400,
      `Invalid import data${path ? ` at ${path}` : ''}: ${issue.message}`
    )
  }

  const db = getDbConn()
  const events = await db.selectFrom('event').select(['id', 'slug']).execute()
  const eventBySlug = new Map(events.map((e) => [e.slug, e.id]))

  // Rows with no groupLabel become solo invites; group each one under a unique
  // synthetic key so they don't collide with each other in the grouping map.
  const groupedByKey = new Map<string, typeof parsed.data.rows>()
  for (const [i, row] of parsed.data.rows.entries()) {
    const key = row.groupLabel ?? `__solo__:${i}`
    const arr = groupedByKey.get(key) ?? []
    arr.push(row)
    groupedByKey.set(key, arr)
  }

  const now = nowIso()
  const created: ImportResult['created'] = []
  const skipped: string[] = []

  for (const [key, labelRows] of groupedByKey) {
    const isSolo = key.startsWith('__solo__:')
    const label: string | null = isSolo ? null : key

    if (label !== null) {
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
    }

    const eventIdsForGroup = new Set<string>()
    const createdGuests: {
      id: string
      displayName: string
      inviteCode: string
    }[] = []

    let leaderId: string | null = null

    for (let i = 0; i < labelRows.length; i++) {
      const row = labelRows[i]
      const id = newId('gst')
      const displayName = `${row.firstName}${row.lastName ? ` ${row.lastName}` : ''}`
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

  return { created, skipped }
}
