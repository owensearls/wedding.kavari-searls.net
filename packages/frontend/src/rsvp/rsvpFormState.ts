import { rsvpStatusSchema } from 'db'
import { z } from 'zod'
import type { RsvpGroupResponse } from '../schema'

// Form values shape for the public RSVP form. We keep an entry per guest in
// the party and a sub-entry per event the leader is invited to. Status is
// '' until the user picks a response so react-hook-form can register it as
// a normal value; we exclude empty statuses (and not-responding guests)
// when assembling the submission payload.

export const eventStatusFormSchema = z.union([z.literal(''), rsvpStatusSchema])

export const eventDraftFormSchema = z.object({
  eventId: z.string(),
  status: eventStatusFormSchema,
  notesJson: z.record(z.string(), z.string().nullable()),
})

const notesJsonShape = z.record(z.string(), z.string().nullable())

export const guestDraftFormSchema = z
  .object({
    guestId: z.string(),
    respondingFor: z.boolean(),
    notesJson: notesJsonShape,
    events: z.array(eventDraftFormSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.respondingFor) return
    // When responding for a guest, every event must have a chosen status.
    data.events.forEach((ev, idx) => {
      if (ev.status === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', idx, 'status'],
          message: 'Please choose a response for this event.',
        })
      }
    })
  })

export const rsvpFormSchema = z.object({
  drafts: z.array(guestDraftFormSchema),
})

export type EventDraftForm = z.infer<typeof eventDraftFormSchema>
export type GuestDraftForm = z.infer<typeof guestDraftFormSchema>
export type RsvpFormValues = z.infer<typeof rsvpFormSchema>

export function formatRsvpDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export function buildInitialRsvpFormValues(
  data: RsvpGroupResponse
): RsvpFormValues {
  const responsesByGuestId = new Map(data.responses.map((r) => [r.guestId, r]))
  const ordered = [
    ...data.guests.filter((g) => g.id === data.actingGuestId),
    ...data.guests.filter((g) => g.id !== data.actingGuestId),
  ]
  return {
    drafts: ordered.map((g) => {
      const lr = responsesByGuestId.get(g.id)
      const eventByEventId = new Map(
        (lr?.events ?? []).map((e) => [e.eventId, e])
      )
      return {
        guestId: g.id,
        respondingFor: true,
        notesJson: { ...(lr?.notesJson ?? {}) },
        events: data.events.map((ev) => {
          const stored = eventByEventId.get(ev.id)
          return {
            eventId: ev.id,
            status: stored?.status ?? '',
            notesJson: { ...(stored?.notesJson ?? {}) },
          }
        }),
      }
    }),
  }
}
