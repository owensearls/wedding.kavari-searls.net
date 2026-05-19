'use server'

import {
  aggregateLookupMatches,
  buildNotesValidator,
  diffGuestResponse,
  getDb,
  latestGuestResponses,
  newId,
  nowIso,
  parseNotesSchema,
  rsvpSubmissionSchema,
  type GuestEventResponse,
  type NotesJson,
  type RsvpSubmission,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  lookupQuerySchema,
  type EventDetails,
  type Guest,
  type LatestGuestResponse,
  type LookupResponse,
  type PublicConfig,
  type RsvpGroupResponse,
} from '../schema'
import type { z } from 'zod'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): NotesJson {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function formatZodIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

async function lookupByNameAllowed(): Promise<boolean> {
  const db = getDbConn()
  const row = await db
    .selectFrom('admin_settings')
    .select('lookup_by_name_enabled')
    .where('id', '=', 'default')
    .executeTakeFirst()
  return row ? row.lookup_by_name_enabled !== 0 : true
}

export async function getPublicConfig(): Promise<PublicConfig> {
  return { lookupByNameEnabled: await lookupByNameAllowed() }
}

export async function lookupGuests(query: string): Promise<LookupResponse> {
  const parsed = lookupQuerySchema.safeParse({ query })
  if (!parsed.success) {
    throw new RscFunctionError(400, 'Missing or invalid query parameter')
  }
  const { query: q } = parsed.data

  const db = getDbConn()

  // Always allow exact-invite-code lookup — that's the "you have the code"
  // path and can't be enumerated.
  const trimmed = q.trim().toLowerCase()
  const exactByCode = await db
    .selectFrom('guest')
    .select([
      'guest.display_name as displayName',
      'guest.invite_code as inviteCode',
      'guest.party_leader_id as partyLeaderId',
      'guest.id as guestId',
      'guest.group_label as groupLabel',
    ])
    .where('guest.invite_code', '=', trimmed)
    .executeTakeFirst()
  if (exactByCode) {
    return {
      matches: [
        {
          partyLeaderId: exactByCode.partyLeaderId ?? exactByCode.guestId,
          inviteCode: exactByCode.inviteCode ?? '',
          label: exactByCode.groupLabel ?? '',
          guestNames: [exactByCode.displayName],
        },
      ],
    }
  }

  if (!(await lookupByNameAllowed())) {
    return { matches: [] }
  }

  const rows = await db
    .selectFrom('guest')
    .select([
      'guest.id as guestId',
      'guest.display_name as displayName',
      'guest.first_name as firstName',
      'guest.last_name as lastName',
      'guest.invite_code as inviteCode',
      'guest.party_leader_id as partyLeaderId',
      'guest.group_label as groupLabel',
    ])
    .execute()

  const candidates = rows.map((r) => ({
    guestId: r.guestId,
    displayName: r.displayName,
    firstName: r.firstName,
    lastName: r.lastName,
    inviteCode: r.inviteCode ?? '',
    partyLeaderId: r.partyLeaderId ?? r.guestId,
    groupLabel: r.groupLabel ?? '',
  }))

  return {
    matches: aggregateLookupMatches(candidates, q),
  }
}

export async function getRsvpGroup(code: string): Promise<RsvpGroupResponse> {
  if (!code) throw new RscFunctionError(400, 'Missing invite code')
  const db = getDbConn()

  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) throw new RscFunctionError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', leaderId)
    .executeTakeFirst()
  if (!leader) throw new RscFunctionError(404, 'Party leader not found')

  const members = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', '=', leaderId)
    .execute()
  const allGuests = [leader, ...members]
  const guestIds = allGuests.map((g) => g.id)

  const invitations = await db
    .selectFrom('invitation')
    .selectAll()
    .where('guest_id', '=', leaderId)
    .execute()
  const eventIds = invitations.map((i) => i.event_id)

  // Invite-level schema: same across all of a leader's invitation rows,
  // so picking from any one is fine.
  let invitationNotesSchema = null
  try {
    invitationNotesSchema = parseNotesSchema(
      invitations[0]?.notes_schema ?? null
    )
  } catch {
    throw new RscFunctionError(500, 'Invitation schema is malformed')
  }

  const events = eventIds.length
    ? await db
        .selectFrom('event')
        .selectAll()
        .where('id', 'in', eventIds)
        .orderBy('sort_order')
        .execute()
    : []

  const latestResponses = await latestGuestResponses(db, { guestIds })

  const eventsResponse: EventDetails[] = events.map((e) => {
    let schema
    try {
      schema = parseNotesSchema(e.notes_schema)
    } catch {
      throw new RscFunctionError(500, `Event schema is malformed: ${e.slug}`)
    }
    return {
      id: e.id,
      name: e.name,
      slug: e.slug,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      locationName: e.location_name,
      address: e.address,
      rsvpDeadline: e.rsvp_deadline,
      sortOrder: e.sort_order,
      invitedGuestIds: guestIds,
      notesSchema: schema,
    }
  })

  const latestByGuestId = new Map(latestResponses.map((r) => [r.guestId, r]))

  const guestsResponse: Guest[] = allGuests.map((g) => {
    const lr = latestByGuestId.get(g.id)
    return {
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      displayName: g.display_name,
      inviteCode: g.invite_code ?? '',
      notesJson: parseNotesJson(lr?.notesJson ?? null),
    }
  })

  const responses: LatestGuestResponse[] = allGuests.map((g) => {
    const lr = latestByGuestId.get(g.id)
    return {
      guestId: g.id,
      notesJson: parseNotesJson(lr?.notesJson ?? null),
      events: (lr?.events ?? []).map((e) => ({
        eventId: e.eventId,
        status: e.status,
        notesJson: parseNotesJson(e.notesJson),
      })),
      respondedAt: lr?.respondedAt ?? null,
    }
  })

  return {
    group: { id: leaderId, label: leader.group_label ?? '' },
    actingGuestId: actingGuest.id,
    guests: guestsResponse,
    events: eventsResponse,
    responses,
    invitationNotesSchema,
  }
}

export async function submitRsvp(
  code: string,
  submission: RsvpSubmission
): Promise<{ ok: true; respondedAt: string }> {
  if (!code) throw new RscFunctionError(400, 'Missing invite code')

  const parsed = rsvpSubmissionSchema.safeParse(submission)
  if (!parsed.success)
    throw new RscFunctionError(400, 'Invalid submission data')
  const data = parsed.data

  const db = getDbConn()

  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) throw new RscFunctionError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const partyGuests = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([eb('id', '=', leaderId), eb('party_leader_id', '=', leaderId)])
    )
    .execute()
  const allowedGuestIds = new Set(partyGuests.map((g) => g.id))

  if (!allowedGuestIds.has(data.respondedByGuestId)) {
    throw new RscFunctionError(400, 'respondedByGuestId is not in this group')
  }

  const invitations = await db
    .selectFrom('invitation')
    .select(['event_id', 'notes_schema'])
    .where('guest_id', '=', leaderId)
    .execute()
  const invitedEventIds = new Set(invitations.map((i) => i.event_id))

  let invitationSchema
  try {
    invitationSchema = parseNotesSchema(invitations[0]?.notes_schema ?? null)
  } catch {
    throw new RscFunctionError(500, 'Invitation schema is malformed')
  }

  const eventRows = invitedEventIds.size
    ? await db
        .selectFrom('event')
        .select(['id', 'notes_schema'])
        .where('id', 'in', [...invitedEventIds])
        .execute()
    : []
  const eventSchemaByEventId = new Map<
    string,
    ReturnType<typeof parseNotesSchema>
  >()
  for (const e of eventRows) {
    try {
      eventSchemaByEventId.set(e.id, parseNotesSchema(e.notes_schema))
    } catch {
      throw new RscFunctionError(500, 'Event schema is malformed')
    }
  }

  // Validate each guest's invite-level notes against the invitation schema.
  const sanitizedGuests = new Map<
    string,
    { notesJson: NotesJson; events: GuestEventResponse[] }
  >()
  for (const gr of data.guestResponses) {
    if (!allowedGuestIds.has(gr.guestId)) {
      throw new RscFunctionError(
        400,
        `Guest ${gr.guestId} is not in this group`
      )
    }

    let cleanNotes: NotesJson = {}
    if (invitationSchema) {
      const result = buildNotesValidator(invitationSchema).safeParse(
        gr.notesJson ?? {}
      )
      if (!result.success) {
        throw new RscFunctionError(400, formatZodIssue(result.error))
      }
      cleanNotes = result.data
    } else if (gr.notesJson && Object.keys(gr.notesJson).length > 0) {
      throw new RscFunctionError(400, 'Invitation has no custom fields')
    }

    const cleanEvents: GuestEventResponse[] = []
    for (const ev of gr.events) {
      if (!invitedEventIds.has(ev.eventId)) {
        throw new RscFunctionError(
          400,
          `Group is not invited to event ${ev.eventId}`
        )
      }
      const eventSchema = eventSchemaByEventId.get(ev.eventId) ?? null
      let eventNotes: NotesJson = {}
      if (eventSchema) {
        const result = buildNotesValidator(eventSchema).safeParse(
          ev.notesJson ?? {}
        )
        if (!result.success) {
          throw new RscFunctionError(400, formatZodIssue(result.error))
        }
        eventNotes = result.data
      } else if (ev.notesJson && Object.keys(ev.notesJson).length > 0) {
        throw new RscFunctionError(400, 'Event has no custom fields')
      }
      cleanEvents.push({
        eventId: ev.eventId,
        status: ev.status,
        notesJson: eventNotes,
      })
    }

    sanitizedGuests.set(gr.guestId, {
      notesJson: cleanNotes,
      events: cleanEvents,
    })
  }

  const guestIdsTouched = [...sanitizedGuests.keys()]
  const latestResponses = await latestGuestResponses(db, {
    guestIds: guestIdsTouched,
  })
  const latestByGuestId = new Map(latestResponses.map((r) => [r.guestId, r]))

  const now = nowIso()

  for (const [guestId, snapshot] of sanitizedGuests) {
    const latest = latestByGuestId.get(guestId)
    const diff = diffGuestResponse({
      latest: latest
        ? {
            notesJson: latest.notesJson,
            events: latest.events.map((e) => ({
              eventId: e.eventId,
              status: e.status,
              notesJson: e.notesJson,
            })),
          }
        : null,
      submitted: snapshot,
    })
    if (!diff.insert) continue

    const guestResponseId = newId('gresp')
    await db
      .insertInto('guest_response')
      .values({
        id: guestResponseId,
        guest_id: guestId,
        notes_json: diff.notesJson,
        responded_at: now,
        responded_by_guest_id: data.respondedByGuestId,
      })
      .execute()

    for (const ev of diff.events) {
      await db
        .insertInto('guest_invitation_response')
        .values({
          id: newId('gir'),
          guest_response_id: guestResponseId,
          event_id: ev.eventId,
          status: ev.status,
          notes_json: ev.notesJson,
        })
        .execute()
    }
  }

  return { ok: true, respondedAt: now }
}
