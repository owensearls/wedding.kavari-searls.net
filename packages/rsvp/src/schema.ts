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
  email: z.preprocess(blankToNull, z.email().max(200).nullable().optional()),
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

// ── JSON Schema notes-field admin input shapes ───────────────────────────

export const shortTextFieldSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.literal('string'),
  maxLength: z.number().int().min(1).max(2000),
})
export type ShortTextFieldInput = z.infer<typeof shortTextFieldSchema>

export const singleSelectOptionSchema = z.object({
  const: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  title: z.string().min(1).max(200),
  description: z.preprocess(blankToNull, z.string().max(500).nullable()),
})
export type SingleSelectOptionInput = z.infer<typeof singleSelectOptionSchema>

export const singleSelectFieldSchema = z
  .object({
    title: z.string().min(1).max(200),
    oneOf: z.array(singleSelectOptionSchema).min(1),
  })
  .refine((f) => new Set(f.oneOf.map((o) => o.const)).size === f.oneOf.length, {
    message: 'Duplicate option ids',
    path: ['oneOf'],
  })
export type SingleSelectFieldInput = z.infer<typeof singleSelectFieldSchema>

export const notesFieldSchema = z.union([
  shortTextFieldSchema,
  singleSelectFieldSchema,
])
export type NotesFieldInput = z.infer<typeof notesFieldSchema>

export const adminFieldDraftSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case'),
  field: notesFieldSchema,
})
export type AdminFieldDraft = z.infer<typeof adminFieldDraftSchema>

export const adminEventInputSchema = z
  .object({
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
    address: z.preprocess(
      blankToNull,
      z.string().max(500).nullable().optional()
    ),
    rsvpDeadline: z.preprocess(blankToNull, z.string().nullable().optional()),
    sortOrder: z.number().int().default(0),
    notesSchema: z.array(adminFieldDraftSchema).default([]),
  })
  .refine(
    (d) =>
      new Set(d.notesSchema.map((f) => f.key)).size === d.notesSchema.length,
    { message: 'Duplicate field keys', path: ['notesSchema'] }
  )
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
