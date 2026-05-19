import { z } from 'zod'
import {
  guestResponseSubmissionSchema,
  rsvpStatusSchema,
  type NotesJsonSchema,
} from 'db'

export {
  guestEventResponseSchema,
  guestResponseSubmissionSchema,
  rsvpStatusSchema,
  rsvpSubmissionSchema,
  type GuestEventResponse,
  type GuestResponseSubmission,
  type RsvpStatus,
  type RsvpSubmission,
} from 'db'

export const lookupQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
})
export type LookupQuery = z.infer<typeof lookupQuerySchema>

export const lookupMatchSchema = z.object({
  partyLeaderId: z.string(),
  inviteCode: z.string(),
  label: z.string(),
  guestNames: z.array(z.string()),
})
export type LookupMatch = z.infer<typeof lookupMatchSchema>

export const lookupResponseSchema = z.object({
  matches: z.array(lookupMatchSchema),
})
export type LookupResponse = z.infer<typeof lookupResponseSchema>

export const notesJsonSchema = z.record(z.string(), z.string().nullable())
export type NotesJson = z.infer<typeof notesJsonSchema>

// Wire schema mirroring db's NotesJsonSchema. Used for parsing server
// responses and validating per-event/invite-level notes_schema.
const shortTextFieldShape = z.object({
  title: z.string(),
  type: z.literal('string'),
  maxLength: z.number(),
})

const singleSelectOptionShape = z.object({
  const: z.string(),
  title: z.string(),
  description: z.string().nullable(),
})

const singleSelectFieldShape = z.object({
  title: z.string(),
  oneOf: z.array(singleSelectOptionShape),
})

const notesFieldShape = z.union([shortTextFieldShape, singleSelectFieldShape])

export const notesJsonSchemaShape = z.object({
  $schema: z.string().optional(),
  type: z.literal('object'),
  additionalProperties: z.literal(false),
  'x-fieldOrder': z.array(z.string()),
  properties: z.record(z.string(), notesFieldShape),
}) as z.ZodType<NotesJsonSchema>

export const guestSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  displayName: z.string(),
  inviteCode: z.string(),
  notesJson: notesJsonSchema,
})
export type Guest = z.infer<typeof guestSchema>

export const publicConfigSchema = z.object({
  lookupByNameEnabled: z.boolean(),
})
export type PublicConfig = z.infer<typeof publicConfigSchema>

export const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  locationName: z.string().nullable(),
  address: z.string().nullable(),
  rsvpDeadline: z.string().nullable(),
  sortOrder: z.number(),
  notesSchema: notesJsonSchemaShape.nullable(),
  invitedGuestIds: z.array(z.string()),
})
export type EventDetails = z.infer<typeof eventSchema>

// Per-guest snapshot of the latest stored response, matching the
// guest_response + guest_invitation_response join. This is what the
// public form prefills with and edits against.
export const latestGuestEventResponseSchema = z.object({
  eventId: z.string(),
  status: rsvpStatusSchema,
  notesJson: notesJsonSchema,
})
export type LatestGuestEventResponse = z.infer<
  typeof latestGuestEventResponseSchema
>

export const latestGuestResponseSchema = z.object({
  guestId: z.string(),
  notesJson: notesJsonSchema,
  events: z.array(latestGuestEventResponseSchema),
  respondedAt: z.string().nullable(),
})
export type LatestGuestResponse = z.infer<typeof latestGuestResponseSchema>

export const rsvpGroupResponseSchema = z.object({
  group: z.object({
    id: z.string(),
    label: z.string(),
  }),
  actingGuestId: z.string(),
  guests: z.array(guestSchema),
  events: z.array(eventSchema),
  responses: z.array(latestGuestResponseSchema),
  invitationNotesSchema: notesJsonSchemaShape.nullable(),
})
export type RsvpGroupResponse = z.infer<typeof rsvpGroupResponseSchema>

// Builder helper for the public form: turns a draft into the canonical
// submission shape. The form state owns one GuestResponseSubmission per
// guest the user is responding for.
export const formGuestResponseSchema = guestResponseSubmissionSchema
export type FormGuestResponse = z.infer<typeof formGuestResponseSchema>
