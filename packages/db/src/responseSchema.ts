import { z } from 'zod'
import type { NotesJson } from './notesSchema'

// Canonical wire/data model for an RSVP submission. One submission carries
// a list of per-guest responses; each per-guest response carries the
// guest's invite-level notes and a child array of per-event responses.
// This shape mirrors guest_response (parent) + guest_invitation_response
// (children) exactly so it can serve as the Zod source of truth for both
// the public form and the server-side submit/validation logic.

const notesJsonRecordSchema: z.ZodType<NotesJson> = z.record(
  z.string(),
  z.string().nullable()
)

export const rsvpStatusSchema = z.enum(['attending', 'declined'])
export type RsvpStatus = z.infer<typeof rsvpStatusSchema>

export const guestEventResponseSchema = z.object({
  eventId: z.string(),
  status: rsvpStatusSchema,
  notesJson: notesJsonRecordSchema.default({}),
})
export type GuestEventResponse = z.infer<typeof guestEventResponseSchema>

export const guestResponseSubmissionSchema = z.object({
  guestId: z.string(),
  notesJson: notesJsonRecordSchema.default({}),
  events: z.array(guestEventResponseSchema).default([]),
})
export type GuestResponseSubmission = z.infer<
  typeof guestResponseSubmissionSchema
>

export const rsvpSubmissionSchema = z.object({
  respondedByGuestId: z.string(),
  guestResponses: z.array(guestResponseSubmissionSchema),
})
export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>
