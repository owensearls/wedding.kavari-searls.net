import { z } from 'zod'
import { ageGroupSchema } from './rsvp'

// Trim-empty-string to undefined. Keeps "0" and whitespace-only-but-non-empty
// cells behaving sensibly; blank CSV / form cells become undefined so optional
// and default-wrapped schemas work as callers expect.
const blankToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v

// Same, but for fields stored as `null` (nullable DB columns).
const blankToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

export const adminGuestInputSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.preprocess(blankToNull, z.string().max(100).nullable().optional()),
  email: z.preprocess(
    blankToNull,
    z.string().email().max(200).nullable().optional(),
  ),
  phone: z.preprocess(blankToNull, z.string().max(50).nullable().optional()),
  ageGroup: z.preprocess(blankToUndef, ageGroupSchema.default('adult')),
  dietaryRestrictions: z.preprocess(
    blankToNull,
    z.string().max(500).nullable().optional(),
  ),
  notes: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
})
export type AdminGuestInput = z.infer<typeof adminGuestInputSchema>

export const adminGroupInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(200),
  inviteCode: z.string().min(4).max(40).optional(),
  notes: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
  guests: z.array(adminGuestInputSchema).min(1),
  invitedEventIds: z.array(z.string()).default([]),
})
export type AdminGroupInput = z.infer<typeof adminGroupInputSchema>

export const adminImportRowSchema = z.object({
  groupLabel: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.preprocess(blankToUndef, z.string().optional()),
  email: z.preprocess(blankToUndef, z.string().optional()),
  phone: z.preprocess(blankToUndef, z.string().optional()),
  ageGroup: z.preprocess(blankToUndef, ageGroupSchema.optional()),
  events: z.preprocess(blankToUndef, z.string().optional()),
})
export type AdminImportRow = z.infer<typeof adminImportRowSchema>

export const adminImportSchema = z.object({
  rows: z.array(adminImportRowSchema).min(1).max(2000),
})
export type AdminImport = z.infer<typeof adminImportSchema>

export const adminEventInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  startsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  endsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  locationName: z.preprocess(
    blankToNull,
    z.string().max(200).nullable().optional(),
  ),
  address: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
  rsvpDeadline: z.preprocess(blankToNull, z.string().nullable().optional()),
  requiresMealChoice: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  mealOptions: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1).max(200),
        description: z.preprocess(
          blankToNull,
          z.string().max(500).nullable().optional(),
        ),
        isChildMeal: z.boolean().default(false),
        isVegetarian: z.boolean().default(false),
      }),
    )
    .default([]),
})
export type AdminEventInput = z.infer<typeof adminEventInputSchema>

export const adminGroupListItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  inviteCode: z.string(),
  guestCount: z.number(),
  attendingCount: z.number(),
  declinedCount: z.number(),
  pendingCount: z.number(),
  updatedAt: z.string(),
})
export type AdminGroupListItem = z.infer<typeof adminGroupListItemSchema>

export const adminResponseRowSchema = z.object({
  groupLabel: z.string(),
  inviteCode: z.string(),
  guestName: z.string(),
  eventName: z.string(),
  status: z.string(),
  mealLabel: z.string().nullable(),
  dietaryRestrictions: z.string().nullable(),
  respondedAt: z.string().nullable(),
})
export type AdminResponseRow = z.infer<typeof adminResponseRowSchema>
