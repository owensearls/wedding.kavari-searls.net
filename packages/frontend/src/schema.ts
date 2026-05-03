import { z } from 'zod'

export const rsvpStatusSchema = z.enum(['attending', 'declined'])
export type RsvpStatus = z.infer<typeof rsvpStatusSchema>

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

export const customFieldOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
})
export type CustomFieldOption = z.infer<typeof customFieldOptionSchema>

export const customFieldConfigSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.enum(['short_text', 'single_select']),
  sortOrder: z.number(),
  options: z.array(customFieldOptionSchema),
})
export type CustomFieldConfig = z.infer<typeof customFieldConfigSchema>

export const notesJsonSchema = z.record(z.string(), z.string().nullable())
export type NotesJson = z.infer<typeof notesJsonSchema>

export const guestRsvpSchema = z.object({
  guestId: z.string(),
  eventId: z.string(),
  status: z.enum(['pending', 'attending', 'declined']),
  notesJson: notesJsonSchema.optional().default({}),
})

export const guestUpdateSchema = z.object({
  guestId: z.string(),
  notes: z.string().max(500).nullable().optional(),
  notesJson: notesJsonSchema.optional().default({}),
})

export const rsvpSubmissionSchema = z.object({
  respondedByGuestId: z.string(),
  rsvps: z.array(guestRsvpSchema),
  guestUpdates: z.array(guestUpdateSchema).optional().default([]),
})
export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>

export const guestSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  inviteCode: z.string(),
  notes: z.string().nullable(),
  notesJson: notesJsonSchema,
})
export type Guest = z.infer<typeof guestSchema>

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
  customFields: z.array(customFieldConfigSchema),
  invitedGuestIds: z.array(z.string()),
})
export type EventDetails = z.infer<typeof eventSchema>

export const rsvpRecordSchema = z.object({
  guestId: z.string(),
  eventId: z.string(),
  status: rsvpStatusSchema,
  notesJson: notesJsonSchema,
  respondedAt: z.string().nullable(),
})
export type RsvpRecord = z.infer<typeof rsvpRecordSchema>

export const rsvpGroupResponseSchema = z.object({
  group: z.object({
    id: z.string(),
    label: z.string(),
  }),
  actingGuestId: z.string(),
  guests: z.array(guestSchema),
  events: z.array(eventSchema),
  rsvps: z.array(rsvpRecordSchema),
  guestCustomFields: z.array(customFieldConfigSchema),
})
export type RsvpGroupResponse = z.infer<typeof rsvpGroupResponseSchema>
