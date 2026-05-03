import { z } from 'zod'

const blankToUndef = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v

const blankToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

export const adminGuestInputSchema = z.object({
  id: z.string().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.preprocess(
    blankToNull,
    z.string().max(100).nullable().optional()
  ),
  email: z.preprocess(
    blankToNull,
    z.string().email().max(200).nullable().optional()
  ),
  phone: z.preprocess(blankToNull, z.string().max(50).nullable().optional()),
})
export type AdminGuestInput = z.infer<typeof adminGuestInputSchema>

export const adminGroupInputSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().max(200).default(''),
    guests: z.array(adminGuestInputSchema).min(1),
    invitedEventIds: z.array(z.string()).default([]),
  })
  .refine((data) => data.guests.length <= 1 || data.label.trim().length > 0, {
    message: 'Label is required when there are additional guests',
    path: ['label'],
  })
export type AdminGroupInput = z.infer<typeof adminGroupInputSchema>

export const adminImportRowSchema = z.object({
  groupLabel: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.preprocess(blankToUndef, z.string().optional()),
  email: z.preprocess(blankToUndef, z.string().optional()),
  phone: z.preprocess(blankToUndef, z.string().optional()),
  events: z.preprocess(blankToUndef, z.string().optional()),
})
export type AdminImportRow = z.infer<typeof adminImportRowSchema>

export const adminImportSchema = z.object({
  rows: z.array(adminImportRowSchema).min(1).max(2000),
})
export type AdminImport = z.infer<typeof adminImportSchema>

// Custom-field admin input
export const adminCustomFieldOptionInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(200),
  description: z.preprocess(
    blankToNull,
    z.string().max(500).nullable().optional()
  ),
  sortOrder: z.number().int().default(0),
})
export type AdminCustomFieldOptionInput = z.infer<
  typeof adminCustomFieldOptionInputSchema
>

export const adminCustomFieldInputSchema = z
  .object({
    id: z.string().optional(),
    key: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case'),
    label: z.string().min(1).max(200),
    type: z.enum(['short_text', 'single_select']),
    sortOrder: z.number().int().default(0),
    options: z.array(adminCustomFieldOptionInputSchema).default([]),
  })
  .refine((d) => d.type === 'single_select' || d.options.length === 0, {
    message: 'Options only allowed for single_select fields',
    path: ['options'],
  })
export type AdminCustomFieldInput = z.infer<typeof adminCustomFieldInputSchema>

// Event admin input (drops mealOptions / requiresMealChoice)
export const adminEventInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  startsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  endsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  locationName: z.preprocess(
    blankToNull,
    z.string().max(200).nullable().optional()
  ),
  address: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
  rsvpDeadline: z.preprocess(blankToNull, z.string().nullable().optional()),
  sortOrder: z.number().int().default(0),
  customFields: z.array(adminCustomFieldInputSchema).default([]),
})
export type AdminEventInput = z.infer<typeof adminEventInputSchema>

// Admin display shapes
export const adminGuestEventStatusSchema = z.object({
  eventId: z.string(),
  status: z.enum(['pending', 'attending', 'declined', 'not-invited']),
  notesJson: z.record(z.string(), z.string().nullable()),
})
export type AdminGuestEventStatus = z.infer<typeof adminGuestEventStatusSchema>

export const adminGroupListGuestSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  inviteCode: z.string(),
  notes: z.string().nullable(),
  notesJson: z.record(z.string(), z.string().nullable()),
  eventStatuses: z.array(adminGuestEventStatusSchema),
})
export type AdminGroupListGuest = z.infer<typeof adminGroupListGuestSchema>

export const adminGroupListItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  guestCount: z.number(),
  attendingCount: z.number(),
  declinedCount: z.number(),
  pendingCount: z.number(),
  updatedAt: z.string(),
  guests: z.array(adminGroupListGuestSchema),
})
export type AdminGroupListItem = z.infer<typeof adminGroupListItemSchema>

export const adminGuestDetailEventSchema = z.object({
  eventId: z.string(),
  eventName: z.string(),
  status: z.enum(['pending', 'attending', 'declined', 'not-invited']),
  notesJson: z.record(z.string(), z.string().nullable()),
  respondedAt: z.string().nullable(),
  respondedByDisplayName: z.string().nullable(),
})

export const adminGuestDetailSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  inviteCode: z.string(),
  notes: z.string().nullable(),
  notesJson: z.record(z.string(), z.string().nullable()),
  groupLabel: z.string(),
  events: z.array(adminGuestDetailEventSchema),
})
export type AdminGuestDetail = z.infer<typeof adminGuestDetailSchema>

export const adminResponseRowSchema = z.object({
  groupLabel: z.string(),
  inviteCode: z.string(),
  guestName: z.string(),
  eventName: z.string(),
  status: z.string(),
  customAnswers: z.string(),
  notes: z.string().nullable(),
  respondedAt: z.string().nullable(),
})
export type AdminResponseRow = z.infer<typeof adminResponseRowSchema>

// Custom-field display shapes (mirrors db package's CustomFieldConfig).
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
