'use server'

import {
  getDb,
  latestGuestResponses,
  parseNotesSchema,
  type NotesJsonSchema,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import type { AdminGuestDetail } from '../../schema'

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
    invitationNotesSchema: NotesJsonSchema | null
    eventNotesSchemaByEvent: Record<string, NotesJsonSchema | null>
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
      'invitation.notes_schema as invitationNotesSchemaRaw',
      'event.name as eventName',
      'event.sort_order as sortOrder',
      'event.notes_schema as eventNotesSchemaRaw',
    ])
    .where('invitation.guest_id', '=', leaderId)
    .orderBy('event.sort_order')
    .execute()

  let invitationNotesSchema: NotesJsonSchema | null = null
  try {
    invitationNotesSchema = parseNotesSchema(
      invitations[0]?.invitationNotesSchemaRaw ?? null
    )
  } catch {
    invitationNotesSchema = null
  }

  const eventNotesSchemaByEvent: Record<string, NotesJsonSchema | null> = {}
  for (const inv of invitations) {
    try {
      eventNotesSchemaByEvent[inv.eventId] = parseNotesSchema(
        inv.eventNotesSchemaRaw
      )
    } catch {
      eventNotesSchemaByEvent[inv.eventId] = null
    }
  }

  const latestResponses = await latestGuestResponses(db, { guestIds: [id] })
  const lr = latestResponses[0]

  const responderName = lr?.respondedByGuestId
    ? ((
        await db
          .selectFrom('guest')
          .select(['display_name'])
          .where('id', '=', lr.respondedByGuestId)
          .executeTakeFirst()
      )?.display_name ?? null)
    : null

  const eventsByEventId = new Map((lr?.events ?? []).map((e) => [e.eventId, e]))

  const events = invitations.map((inv) => {
    const e = eventsByEventId.get(inv.eventId)
    return {
      eventId: inv.eventId,
      eventName: inv.eventName,
      status: e?.status ?? ('pending' as const),
      notesJson: parseNotesJson(e?.notesJson ?? null),
      respondedAt: e ? (lr?.respondedAt ?? null) : null,
      respondedByDisplayName: e ? responderName : null,
    }
  })

  return {
    id: guest.id,
    displayName: guest.display_name,
    email: guest.email,
    phone: guest.phone,
    inviteCode: guest.invite_code ?? '',
    notesJson: parseNotesJson(lr?.notesJson ?? null),
    groupLabel,
    events,
    invitationNotesSchema,
    eventNotesSchemaByEvent,
  }
}
