'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  type CustomFieldConfig as DbCustomFieldConfig,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import type { AdminGuestDetail, CustomFieldConfig } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function getGuest(id: string): Promise<
  AdminGuestDetail & {
    guestCustomFields: CustomFieldConfig[]
    eventCustomFieldsByEvent: Record<string, CustomFieldConfig[]>
  }
> {
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()

  const guest = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!guest) throw new RscFunctionError(404, 'Guest not found')

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

  const invitations = await db
    .selectFrom('invitation')
    .innerJoin('event', 'event.id', 'invitation.event_id')
    .select([
      'invitation.event_id as eventId',
      'event.name as eventName',
      'event.sort_order as sortOrder',
    ])
    .where('invitation.guest_id', '=', leaderId)
    .orderBy('event.sort_order')
    .execute()

  const eventIds = invitations.map((i) => i.eventId)

  const latestRsvps = await latestRsvpResponses(db, {
    guestIds: [id],
    eventIds,
  })
  const latestGuests = await latestGuestResponses(db, { guestIds: [id] })
  const lg = latestGuests[0]

  const responderIds = Array.from(
    new Set(
      latestRsvps
        .map((r) => r.respondedByGuestId)
        .filter((x): x is string => !!x)
    )
  )
  const responders = responderIds.length
    ? await db
        .selectFrom('guest')
        .select(['id', 'display_name'])
        .where('id', 'in', responderIds)
        .execute()
    : []
  const responderName = new Map(responders.map((r) => [r.id, r.display_name]))

  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)

  const events = invitations.map((inv) => {
    const r = latestRsvps.find((x) => x.eventId === inv.eventId)
    return {
      eventId: inv.eventId,
      eventName: inv.eventName,
      status: r?.status ?? ('pending' as const),
      notesJson: parseNotesJson(r?.notesJson ?? null),
      respondedAt: r?.respondedAt ?? null,
      respondedByDisplayName: r?.respondedByGuestId
        ? (responderName.get(r.respondedByGuestId) ?? null)
        : null,
    }
  })

  // db's CustomFieldConfig is structurally identical to the admin schema's.
  const toAdminCfg = (c: DbCustomFieldConfig): CustomFieldConfig => c

  return {
    id: guest.id,
    displayName: guest.display_name,
    email: guest.email,
    phone: guest.phone,
    inviteCode: guest.invite_code ?? '',
    notes: lg?.notes ?? null,
    notesJson: parseNotesJson(lg?.notesJson ?? null),
    groupLabel,
    events,
    guestCustomFields: guestCustomFields.map(toAdminCfg),
    eventCustomFieldsByEvent: Object.fromEntries(
      [...eventCustomFieldsByEvent.entries()].map(([k, v]) => [
        k,
        v.map(toAdminCfg),
      ])
    ),
  }
}
