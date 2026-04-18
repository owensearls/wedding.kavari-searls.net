import { z } from 'zod'

export const ageGroupSchema = z.enum(['adult', 'child', 'infant'])
export type AgeGroup = z.infer<typeof ageGroupSchema>

export const rsvpStatusSchema = z.enum(['pending', 'attending', 'declined'])
export type RsvpStatus = z.infer<typeof rsvpStatusSchema>

export const lookupQuerySchema = z.object({
  query: z.string().trim().min(1).max(120),
})
export type LookupQuery = z.infer<typeof lookupQuerySchema>

export const lookupMatchSchema = z.object({
  guestGroupId: z.string(),
  inviteCode: z.string(),
  label: z.string(),
  guestNames: z.array(z.string()),
})
export type LookupMatch = z.infer<typeof lookupMatchSchema>

export const lookupResponseSchema = z.object({
  matches: z.array(lookupMatchSchema),
})
export type LookupResponse = z.infer<typeof lookupResponseSchema>

export const guestRsvpSchema = z.object({
  guestId: z.string(),
  eventId: z.string(),
  status: rsvpStatusSchema,
  mealChoiceId: z.string().nullable().optional(),
})

export const guestUpdateSchema = z.object({
  guestId: z.string(),
  dietaryRestrictions: z.string().max(500).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export const songRequestSchema = z.object({
  title: z.string().min(1).max(200),
  artist: z.string().max(200).nullable().optional(),
})

export const rsvpSubmissionSchema = z.object({
  respondedByGuestId: z.string(),
  rsvps: z.array(guestRsvpSchema),
  guestUpdates: z.array(guestUpdateSchema).optional().default([]),
  songRequests: z
    .array(songRequestSchema.extend({ guestId: z.string() }))
    .optional()
    .default([]),
})
export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>

// Read shape — what the GET /api/rsvp/:code endpoint returns.
export const guestSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  ageGroup: ageGroupSchema,
  isPlusOne: z.boolean(),
  dietaryRestrictions: z.string().nullable(),
  notes: z.string().nullable(),
})
export type Guest = z.infer<typeof guestSchema>

export const mealOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  isChildMeal: z.boolean(),
  isVegetarian: z.boolean(),
})
export type MealOption = z.infer<typeof mealOptionSchema>

export const eventSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  locationName: z.string().nullable(),
  address: z.string().nullable(),
  rsvpDeadline: z.string().nullable(),
  requiresMealChoice: z.boolean(),
  sortOrder: z.number(),
  mealOptions: z.array(mealOptionSchema),
  invitedGuestIds: z.array(z.string()),
})
export type EventDetails = z.infer<typeof eventSchema>

export const rsvpRecordSchema = z.object({
  guestId: z.string(),
  eventId: z.string(),
  status: rsvpStatusSchema,
  mealChoiceId: z.string().nullable(),
  respondedAt: z.string().nullable(),
})
export type RsvpRecord = z.infer<typeof rsvpRecordSchema>

export const rsvpGroupResponseSchema = z.object({
  group: z.object({
    id: z.string(),
    label: z.string(),
    inviteCode: z.string(),
  }),
  guests: z.array(guestSchema),
  events: z.array(eventSchema),
  rsvps: z.array(rsvpRecordSchema),
  songRequests: z.array(
    z.object({
      id: z.string(),
      guestId: z.string(),
      title: z.string(),
      artist: z.string().nullable(),
    }),
  ),
})
export type RsvpGroupResponse = z.infer<typeof rsvpGroupResponseSchema>
