'use server'

import {
  aggregateLookupMatches,
  diffGuestResponse,
  diffRsvpResponse,
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  newId,
  nowIso,
  validateNotesJson,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  lookupQuerySchema,
  rsvpSubmissionSchema,
  type EventDetails,
  type Guest,
  type LookupResponse,
  type NotesJson,
  type RsvpGroupResponse,
  type RsvpRecord,
  type RsvpSubmission,
} from '../schema'

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

export async function lookupGuests(query: string): Promise<LookupResponse> {
  const parsed = lookupQuerySchema.safeParse({ query })
  if (!parsed.success) {
    throw new RscFunctionError(400, 'Missing or invalid query parameter')
  }
  const { query: q } = parsed.data

  const db = getDbConn()

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

  const candidates = rows.map((r) => ({
    guestId: r.guestId,
    displayName: r.displayName,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
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

  const events = eventIds.length
    ? await db
        .selectFrom('event')
        .selectAll()
        .where('id', 'in', eventIds)
        .orderBy('sort_order')
        .execute()
    : []

  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)
  const latestRsvps = await latestRsvpResponses(db, { guestIds, eventIds })
  const latestGuests = await latestGuestResponses(db, { guestIds })

  const eventsResponse: EventDetails[] = events.map((e) => ({
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
    customFields: eventCustomFieldsByEvent.get(e.id) ?? [],
  }))

  const latestGuestByGuestId = new Map(latestGuests.map((r) => [r.guestId, r]))

  const guestsResponse: Guest[] = allGuests.map((g) => {
    const lr = latestGuestByGuestId.get(g.id)
    return {
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      displayName: g.display_name,
      email: g.email,
      phone: g.phone,
      inviteCode: g.invite_code ?? '',
      notes: lr?.notes ?? null,
      notesJson: parseNotesJson(lr?.notesJson ?? null),
    }
  })

  const rsvps: RsvpRecord[] = latestRsvps.map((r) => ({
    guestId: r.guestId,
    eventId: r.eventId,
    status: r.status,
    notesJson: parseNotesJson(r.notesJson),
    respondedAt: r.respondedAt,
  }))

  return {
    group: { id: leaderId, label: leader.group_label ?? '' },
    actingGuestId: actingGuest.id,
    guests: guestsResponse,
    events: eventsResponse,
    rsvps,
    guestCustomFields,
  }
}

export async function submitRsvp(
  code: string,
  submission: RsvpSubmission
): Promise<{ ok: true; respondedAt: string }> {
  if (!code) throw new RscFunctionError(400, 'Missing invite code')

  const parsed = rsvpSubmissionSchema.safeParse(submission)
  if (!parsed.success) throw new RscFunctionError(400, 'Invalid submission data')
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
    .select(['event_id'])
    .where('guest_id', '=', leaderId)
    .execute()
  const invitedEventIds = new Set(invitations.map((i) => i.event_id))

  const eventIds = [...invitedEventIds]
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)

  // Validate per-event submissions.
  const sanitizedRsvpNotes = new Map<string, NotesJson>()
  for (const r of data.rsvps) {
    if (!allowedGuestIds.has(r.guestId)) {
      throw new RscFunctionError(400, `Guest ${r.guestId} is not in this group`)
    }
    if (!invitedEventIds.has(r.eventId)) {
      throw new RscFunctionError(
        400,
        `Group is not invited to event ${r.eventId}`
      )
    }
    if (r.status === 'attending' || r.status === 'declined') {
      const config = eventCustomFieldsByEvent.get(r.eventId) ?? []
      const v = validateNotesJson(r.notesJson, config)
      if (!v.ok) throw new RscFunctionError(400, v.error)
      sanitizedRsvpNotes.set(`${r.guestId}::${r.eventId}`, v.value)
    }
  }

  // Validate per-guest submissions.
  const sanitizedGuestNotes = new Map<string, NotesJson>()
  for (const u of data.guestUpdates) {
    if (!allowedGuestIds.has(u.guestId)) continue
    const v = validateNotesJson(u.notesJson, guestCustomFields)
    if (!v.ok) throw new RscFunctionError(400, v.error)
    sanitizedGuestNotes.set(u.guestId, v.value)
  }

  const guestIdsTouched = Array.from(
    new Set([
      ...data.rsvps.map((r) => r.guestId),
      ...data.guestUpdates.map((u) => u.guestId),
    ])
  )

  const latestRsvps = await latestRsvpResponses(db, {
    guestIds: guestIdsTouched,
    eventIds: data.rsvps.map((r) => r.eventId),
  })
  const latestRsvpKey = (g: string, e: string) => `${g}::${e}`
  const latestRsvpMap = new Map(
    latestRsvps.map((r) => [latestRsvpKey(r.guestId, r.eventId), r])
  )

  const latestGuests = await latestGuestResponses(db, {
    guestIds: guestIdsTouched,
  })
  const latestGuestMap = new Map(latestGuests.map((r) => [r.guestId, r]))

  const now = nowIso()

  for (const r of data.rsvps) {
    if (r.status === 'pending') continue
    const sanitized = sanitizedRsvpNotes.get(`${r.guestId}::${r.eventId}`)
    if (!sanitized) continue
    const latest = latestRsvpMap.get(latestRsvpKey(r.guestId, r.eventId))
    const diff = diffRsvpResponse({
      latest: latest
        ? { status: latest.status, notesJson: latest.notesJson }
        : null,
      submitted: { status: r.status, notesJson: sanitized },
    })
    if (!diff.insert) continue
    await db
      .insertInto('rsvp_response')
      .values({
        id: newId('rresp'),
        guest_id: r.guestId,
        event_id: r.eventId,
        status: r.status,
        notes_json: diff.notesJson,
        responded_at: now,
        responded_by_guest_id: data.respondedByGuestId,
      })
      .execute()
  }

  for (const u of data.guestUpdates) {
    if (!allowedGuestIds.has(u.guestId)) continue
    const sanitized = sanitizedGuestNotes.get(u.guestId)
    if (!sanitized) continue
    const latest = latestGuestMap.get(u.guestId)
    const submittedNotes =
      typeof u.notes === 'string' ? u.notes : (u.notes ?? null)
    const diff = diffGuestResponse({
      latest: latest
        ? { notes: latest.notes, notesJson: latest.notesJson }
        : null,
      submitted: { notes: submittedNotes, notesJson: sanitized },
    })
    if (!diff.insert) continue
    await db
      .insertInto('guest_response')
      .values({
        id: newId('gresp'),
        guest_id: u.guestId,
        notes: diff.notes,
        notes_json: diff.notesJson,
        responded_at: now,
        responded_by_guest_id: data.respondedByGuestId,
      })
      .execute()
  }

  return { ok: true, respondedAt: now }
}
