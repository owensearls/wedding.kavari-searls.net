# Custom Fields as JSON Schema

Replace the relational custom-field configuration (four tables) with a single JSON Schema document persisted alongside `notes_json`. JSON Schema becomes the canonical, conceptual heart of the custom-field system: storage, validation, form rendering, and admin display all derive from one document. Drop the global guest-profile admin UI in favour of a hardcoded schema in source. Merge the admin Log into a single chronological table.

## Goals

- Custom fields for an event are described by a single JSON Schema document persisted as `event.notes_schema` (TEXT). Mirrors `notes_json` on `rsvp_response`.
- Guest-profile fields (dietary restrictions, song request) are described by a hardcoded JSON Schema constant in source. No DB table, no admin UI for editing.
- A single Zod validator built from the schema enforces the shape of every public submission's `notes_json`. No bespoke validator code.
- Admin editor's working state is the schema, expressed as an ordered list of `{ key, field }` drafts. No translation between an admin-input shape and a separate config shape.
- Public form, admin display, and CSV export consume the parsed schema directly. No flat intermediate type.
- The Log tab renders a single merged, time-ordered table with a Type column distinguishing RSVP vs. Guest-profile rows.
- Zod 4 throughout the project (upgrade from Zod 3).

## Out of scope

- Custom-field types beyond `short_text` and `single_select`. The JSON Schema vocabulary trivially extends to more types (number, date, boolean, long_text), but ship the same two we have today.
- Conditional visibility (e.g., "show field X only when status=attending"). The hardcoded "show event custom fields only when attending" rule stays.
- Required-vs-optional fields. Every field is optional; missing key ⇒ unanswered. JSON Schema's `required` array stays empty (or absent).
- Migrating any production data — this is pre-launch; one consolidated migration.
- Per-guest scoping for guest-profile fields. They apply to every guest in a party, primary or not. (The previous append-only-RSVP plan already dropped the "song request is leader-only" UI quirk; this design inherits that uniformity.)
- A generic JSON Schema editor in the admin UI. The editor renders only the two field types we support, bound directly to the schema property body.

## JSON Schema as the conceptual heart

Every read or write of custom-field data flows through one document type: `NotesJsonSchema` (a JSON Schema draft 2020-12 object). There is no parallel "config" representation in memory. The shape:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "x-fieldOrder": ["meal_choice", "dietary_restrictions"],
  "properties": {
    "meal_choice": {
      "title": "Meal choice",
      "oneOf": [
        { "const": "opt_chicken", "title": "Chicken", "description": null },
        { "const": "opt_fish",    "title": "Fish",    "description": null }
      ]
    },
    "dietary_restrictions": {
      "title": "Dietary restrictions or allergies",
      "type": "string",
      "maxLength": 500
    }
  }
}
```

Encoding rules:

- **Property name** is the `notes_json` key (snake_case, `^[a-z][a-z0-9_]*$`, ≤80 chars).
- **`title`** on the property body is the user-facing label.
- **`x-fieldOrder`** is the canonical render order. JS object key insertion order is incidentally preserved but must not be relied on; iterators always consult `x-fieldOrder`.
- **`additionalProperties: false`** rejects unknown keys at validation.
- **Short text** properties: `{ title, type: "string", maxLength: <=2000 }`. Default cap is 500 chars.
- **Single select** properties: `{ title, oneOf: [...] }`, where each entry is `{ const, title, description }`. The `const` is a stable option id (e.g. `opt_chicken`) generated once and never reused. Renaming the option mutates `title`/`description` but never `const`. Stored answers reference `const`.
- **No `required` array.** Missing keys are unanswered. Empty short_text values are coerced to `null` and treated as if the key were absent (canonical-stringify drops them).
- The schema document itself is not validated against meta-JSON-Schema at runtime. We control the writers; the readers are typed against `NotesJsonSchema` and will surface a parse error (handled as "no custom fields") if a hand-edited row produces malformed JSON.

## Database

Edit `packages/db/migrations/0001_init.sql` in place (pre-launch, single migration). Local dev wipes via `pnpm clean && pnpm db:migrate:local`; remote D1 is wiped before next deploy.

### Removed

- `event_custom_field`, `event_custom_field_option`
- `guest_custom_field`, `guest_custom_field_option`
- The seed `INSERT INTO guest_custom_field` rows

### Added

`event.notes_schema TEXT` column on the existing `event` table. NULL means "no custom fields for this event".

```sql
CREATE TABLE event (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  starts_at TEXT,
  ends_at TEXT,
  location_name TEXT,
  address TEXT,
  rsvp_deadline TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes_schema TEXT
);
```

### Unchanged

- `guest`, `invitation`, `rsvp_response`, `guest_response`. The append-only response tables and their indices are untouched.
- `rsvp_response.notes_json` and `guest_response.notes_json` continue to hold the answer maps. Their schemas are now defined by `event.notes_schema` and the hardcoded guest-profile constant respectively.

### `Database` type (`packages/db/src/schema.ts`)

- Drop `EventCustomFieldTable`, `EventCustomFieldOptionTable`, `GuestCustomFieldTable`, `GuestCustomFieldOptionTable`.
- Drop those four entries from the `Database` interface.
- Add `notes_schema: string | null` to `EventTable`.

## Core module: `packages/db/src/notesSchema.ts`

The conceptual heart. All schema-aware code lives here or routes through this module's exports.

```ts
import { z } from 'zod'

// ── Types (mirror the JSON Schema document we persist) ────────────────────

export interface ShortTextFieldSchema {
  title: string
  type: 'string'
  maxLength: number
}

export interface SingleSelectOptionSchema {
  const: string
  title: string
  description: string | null
}

export interface SingleSelectFieldSchema {
  title: string
  oneOf: SingleSelectOptionSchema[]
}

export type NotesFieldSchema = ShortTextFieldSchema | SingleSelectFieldSchema

export interface NotesJsonSchema {
  $schema?: string
  type: 'object'
  additionalProperties: false
  'x-fieldOrder': string[]
  properties: Record<string, NotesFieldSchema>
}

export type NotesJson = Record<string, string | null>

// ── Pure functions over the schema ────────────────────────────────────────

// Parse a stored notes_schema string. Returns null for null or empty input.
// On malformed JSON, throws — callers (read paths) catch and surface as a 500
// "Event schema is malformed" rather than silently degrading. There is no
// "lenient" mode; admins must re-save the schema to clear it.
export function parseNotesSchema(raw: string | null): NotesJsonSchema | null

export function stringifyNotesSchema(schema: NotesJsonSchema): string

// Iterate properties in x-fieldOrder. The only sanctioned way to walk a schema.
export function fieldsInOrder(
  schema: NotesJsonSchema
): Array<{ key: string; field: NotesFieldSchema }>

export function isShortTextField(f: NotesFieldSchema): f is ShortTextFieldSchema
export function isSingleSelectField(f: NotesFieldSchema): f is SingleSelectFieldSchema

// Look up an option by const id. Returns null if not found.
export function findOption(
  field: SingleSelectFieldSchema,
  id: string
): SingleSelectOptionSchema | null

// Build a Zod validator from a notes schema. Single source of truth for what
// a valid notes_json is.
//   - additionalProperties: false → z.object(...).strict()
//   - short_text: z.string().trim().max(maxLength)
//                 .transform(s => s === '' ? null : s).nullable().optional()
//   - single_select with N≥2 options: z.union(options.map(o => z.literal(o.const)))
//                                     .nullable().optional()
//   - single_select with N=1 option:  z.literal(opt.const).nullable().optional()
//   - empty string '' on a single_select coerces to null via z.preprocess.
//
// Result: a Zod schema whose `.safeParse(notesJson)` returns sanitized data
// (trimmed strings, '' coerced to null) on success.
export function buildNotesValidator(schema: NotesJsonSchema): z.ZodType<NotesJson>
```

## Hardcoded constant: `packages/db/src/guestProfileSchema.ts`

```ts
import type { NotesJsonSchema } from './notesSchema'

export const GUEST_PROFILE_NOTES_SCHEMA: NotesJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  'x-fieldOrder': ['dietary_restrictions', 'song_request'],
  properties: {
    dietary_restrictions: {
      title: 'Dietary restrictions or allergies',
      type: 'string',
      maxLength: 500,
    },
    song_request: {
      title: 'Song request',
      type: 'string',
      maxLength: 500,
    },
  },
}
```

Re-exported through `packages/db/src/index.ts`.

## Code deletions (no shims, no preserved signatures)

- `packages/db/src/diff.ts`
  - Delete: `CustomFieldConfig`, `CustomFieldOption`, `validateNotesJson`, `ValidationResult`.
  - Keep: `canonicalNotesJson`, `RsvpDiffInput`/`RsvpDiffResult`/`diffRsvpResponse`, `GuestDiffInput`/`GuestDiffResult`/`diffGuestResponse`, `NotesJson`, `NotesJsonValue`. (`NotesJson` is re-exported from `notesSchema.ts`; remove the duplicate definition here.)
- `packages/db/src/latest.ts`
  - Delete: `loadEventCustomFields`, `loadGuestCustomFields`.
  - Keep: `latestRsvpResponses`, `latestGuestResponses`.
- `packages/db/src/index.ts`
  - Drop the four deleted exports.
  - Add: every type and function from `notesSchema.ts`, plus `GUEST_PROFILE_NOTES_SCHEMA`.
- `packages/rsvp/src/schema.ts`
  - Delete: `customFieldOptionSchema`, `customFieldConfigSchema`, `CustomFieldOption`, `CustomFieldConfig`, `adminCustomFieldOptionInputSchema`, `adminCustomFieldInputSchema`, `AdminCustomFieldOptionInput`, `AdminCustomFieldInput`.
  - Replace `customFields` on `adminEventInputSchema` with `notesSchema: z.array(adminFieldDraftSchema).default([])` (see "Admin write path").
- `packages/rsvp/src/server/admin/customFields.ts` — delete the entire file. The exported server actions are gone.
- `packages/rsvp/src/server/admin/responses.ts`
  - Drop `eventCustomFields` from `AdminRsvpResponseLogRow`; replace with `notesSchema: NotesJsonSchema | null`.
  - Drop `guestCustomFields` from `listGuestResponseLog` return; the caller imports `GUEST_PROFILE_NOTES_SCHEMA` directly.
  - The merged log changes both server actions further — see "Merged Log".
- `packages/rsvp/src/server/admin/events.ts`
  - Drop the per-row option diff/upsert loops (no more `event_custom_field`/`event_custom_field_option`).
  - `saveEvent` reads `data.notesSchema: AdminFieldDraft[]`, builds a `NotesJsonSchema`, calls `stringifyNotesSchema`, writes to `event.notes_schema`.
  - `listEvents` reads `event.notes_schema`, calls `parseNotesSchema`, calls `fieldsInOrder`, returns drafts to the editor.
- `packages/rsvp/src/admin/lib/customFieldRender.ts`
  - Rewrite `formatCustomAnswers` and `renderCustomFieldValue` to take `(schema: NotesJsonSchema, notesJson: NotesJson)` and walk the schema directly. Use `findOption` for single_select label resolution.
- `packages/rsvp/src/admin/routes/CustomFieldsEditor.tsx`
  - Rebind every input to the JSON Schema property body. Type-toggle reshapes the field object. See "Admin editor".
- `packages/rsvp/src/admin/routes/EventSettings.tsx`
  - Delete the entire "Guest profile fields" `<section>`, the `guestFields*` state, `refreshGuestFields`, `saveGuestFields`, the `configToDraft` helper.
- `packages/frontend/src/schema.ts`
  - Drop `customFields` from `EventDetails`; add `notesSchema: NotesJsonSchema | null`.
  - Drop `guestCustomFields` from `RsvpGroupResponse`; add `guestNotesSchema: NotesJsonSchema`.
- `packages/frontend/src/server/rsvp.ts`
  - Drop `loadEventCustomFields`/`loadGuestCustomFields` calls; replace with `parseNotesSchema(eventRow.notes_schema)` and `GUEST_PROFILE_NOTES_SCHEMA`.
  - Validation switches to `buildNotesValidator(schema).safeParse(notesJson)`.

## Wire shape changes (frontend)

```ts
// packages/frontend/src/schema.ts

import type { NotesJsonSchema } from 'db'

export interface EventDetails {
  id: string
  name: string
  slug: string
  startsAt: string | null
  endsAt: string | null
  locationName: string | null
  address: string | null
  rsvpDeadline: string | null
  sortOrder: number
  invitedGuestIds: string[]
  notesSchema: NotesJsonSchema | null   // null when no custom fields
}

export interface RsvpGroupResponse {
  group: { id: string; label: string }
  actingGuestId: string
  guests: Guest[]
  events: EventDetails[]
  rsvps: RsvpRecord[]
  guestNotesSchema: NotesJsonSchema     // always non-null (hardcoded constant)
}
```

The wire-side Zod schemas in `packages/frontend/src/schema.ts` add a `notesJsonSchemaShape` definition that mirrors `NotesJsonSchema` for parsing server responses (the existing wire schemas already do this for other shapes). Both `EventDetails.notesSchema` and `RsvpGroupResponse.guestNotesSchema` reference it.

## Admin write path

Editor working state uses `AdminFieldDraft` — an ordered list, where each draft's `field` is **exactly** the JSON Schema property body. No flat label/type/options shape exists.

### Zod (`packages/rsvp/src/schema.ts`)

```ts
const blankToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

export const shortTextFieldSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.literal('string'),
  maxLength: z.number().int().min(1).max(2000),
})

export const singleSelectOptionSchema = z.object({
  const: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  title: z.string().min(1).max(200),
  description: z.preprocess(
    blankToNull,
    z.string().max(500).nullable()
  ),
})

export const singleSelectFieldSchema = z.object({
  title: z.string().min(1).max(200),
  oneOf: z.array(singleSelectOptionSchema).min(1),
})

export const notesFieldSchema = z.union([
  shortTextFieldSchema,
  singleSelectFieldSchema,
])

export const adminFieldDraftSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/, 'Use snake_case'),
  field: notesFieldSchema,
})
export type AdminFieldDraft = z.infer<typeof adminFieldDraftSchema>

export const adminEventInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  startsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  endsAt: z.preprocess(blankToNull, z.string().nullable().optional()),
  locationName: z.preprocess(blankToNull, z.string().max(200).nullable().optional()),
  address: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
  rsvpDeadline: z.preprocess(blankToNull, z.string().nullable().optional()),
  sortOrder: z.number().int().default(0),
  notesSchema: z.array(adminFieldDraftSchema).default([]),
})
export type AdminEventInput = z.infer<typeof adminEventInputSchema>
```

`adminFieldDraftSchema` also enforces uniqueness of `key` across the array via `.refine(...)` on `adminEventInputSchema`. Inside a single_select, `oneOf` entries' `const` values must also be unique — refined on `singleSelectFieldSchema`.

### Server (`packages/rsvp/src/server/admin/events.ts`)

```ts
import {
  parseNotesSchema,
  stringifyNotesSchema,
  fieldsInOrder,
  type NotesJsonSchema,
} from 'db'

export async function saveEvent(input: AdminEventInput): Promise<{ id: string }> {
  const parsed = adminEventInputSchema.safeParse(input)
  if (!parsed.success) throw new RscFunctionError(400, 'Invalid event data')
  const data = parsed.data

  const notes_schema = data.notesSchema.length === 0
    ? null
    : stringifyNotesSchema({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        additionalProperties: false,
        'x-fieldOrder': data.notesSchema.map(d => d.key),
        properties: Object.fromEntries(
          data.notesSchema.map(d => [d.key, d.field])
        ),
      })

  // single insert/update on `event` with notes_schema; no per-field row writes.
}

export async function listEvents(): Promise<{ events: AdminEventRecord[] }> {
  const events = await db.selectFrom('event').selectAll().orderBy('sort_order').execute()
  return {
    events: events.map(e => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      locationName: e.location_name,
      address: e.address,
      rsvpDeadline: e.rsvp_deadline,
      sortOrder: e.sort_order,
      notesSchema: schemaToDrafts(parseNotesSchema(e.notes_schema)),
    })),
  }
}

function schemaToDrafts(schema: NotesJsonSchema | null): AdminFieldDraft[] {
  if (!schema) return []
  return fieldsInOrder(schema).map(({ key, field }) => ({ key, field }))
}
```

The `schemaToDrafts` function is the only inverse used in the admin path; it's local to `events.ts`. No shared serializer module.

### Editor component (`CustomFieldsEditor.tsx`)

State shape: `AdminFieldDraft[]`. Inputs bind to:

- `draft.key` — property key input (snake_case, auto-suggested from `draft.field.title` until the user customises).
- `draft.field.title` — label input (user-facing).
- A "type" toggle (Short text / Single select) — switching reshapes `draft.field`:
  - `short_text → single_select`: `{ title: prevTitle, oneOf: [] }` (clears short_text settings; user adds options).
  - `single_select → short_text`: `{ title: prevTitle, type: 'string', maxLength: 500 }`.
- For `short_text`: a `maxLength` numeric input (default 500, hidden behind an "advanced" disclosure if cluttering — call this out for frontend-design).
- For `single_select`: list of options bound to `draft.field.oneOf[i].const`, `…title`, `…description`. New option's `const` auto-generated as `newId('opt')`.

Adding a new field appends `{ key: '', field: { title: '', type: 'string', maxLength: 500 } }`. Reorder via drag handle mutates array order; on save, `x-fieldOrder` is recomputed from the array.

Removing a field drops it from the array. The submit reconstructs the schema; previously-stored answers under that key remain in `notes_json` rows but stop rendering anywhere (orphaned-key tolerance, see "Failure modes").

Type-change semantics for an existing field:

- `short_text → single_select`: existing string answers in `notes_json[key]` remain. They no longer match any option's `const`, so display falls back to a `(legacy)` raw-text rendering.
- `single_select → short_text`: option ids in answers render as raw text. Same `(legacy)` rendering.

No data migration; admin can clear by removing the field and re-creating.

## Validation in `submitRsvp`

```ts
import {
  buildNotesValidator,
  parseNotesSchema,
  GUEST_PROFILE_NOTES_SCHEMA,
} from 'db'

// per-event
const eventSchema = parseNotesSchema(eventRow.notes_schema)
if (eventSchema) {
  const result = buildNotesValidator(eventSchema).safeParse(r.notesJson ?? {})
  if (!result.success) {
    throw new RscFunctionError(400, formatZodIssue(result.error))
  }
  sanitizedRsvpNotes.set(`${r.guestId}::${r.eventId}`, result.data)
} else if (r.notesJson && Object.keys(r.notesJson).length > 0) {
  throw new RscFunctionError(400, 'Event has no custom fields')
}

// per-guest
const guestResult = buildNotesValidator(GUEST_PROFILE_NOTES_SCHEMA)
  .safeParse(u.notesJson ?? {})
if (!guestResult.success) {
  throw new RscFunctionError(400, formatZodIssue(guestResult.error))
}
sanitizedGuestNotes.set(u.guestId, guestResult.data)

function formatZodIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}
```

`buildNotesValidator` is the only validator. The previous `validateNotesJson` is gone.

## Public form rendering

`packages/frontend/src/components/RsvpFull.tsx` and `EventCardEditor.tsx`:

```tsx
import { fieldsInOrder, isShortTextField, isSingleSelectField } from 'db'

{event.notesSchema && fieldsInOrder(event.notesSchema).map(({ key, field }) => {
  if (isShortTextField(field)) {
    return (
      <label key={key}>
        {field.title}
        <input
          type="text"
          maxLength={field.maxLength}
          value={notesJson[key] ?? ''}
          onChange={e => setNotesJson({ ...notesJson, [key]: e.target.value })}
        />
      </label>
    )
  }
  if (isSingleSelectField(field)) {
    return (
      <label key={key}>
        {field.title}
        <select
          value={notesJson[key] ?? ''}
          onChange={e => setNotesJson({ ...notesJson, [key]: e.target.value || null })}
        >
          <option value="">—</option>
          {field.oneOf.map(opt => (
            <option key={opt.const} value={opt.const}>{opt.title}</option>
          ))}
        </select>
      </label>
    )
  }
  return null
})}
```

Same dispatch on the per-guest "Other details" block, iterating `data.guestNotesSchema`. The "Anything else we should know?" hardcoded textarea binds to `guestNotes` (the per-guest `guest_response.notes` column) and stays primary-only.

The "show event custom fields only when status === 'attending'" rule generalises straightforwardly: the schema iteration only runs in the attending branch.

## Admin display

### `customFieldRender.ts` (rewritten)

```ts
import {
  fieldsInOrder,
  findOption,
  isShortTextField,
  isSingleSelectField,
  type NotesJson,
  type NotesJsonSchema,
} from 'db'

export function renderFieldValue(
  field: NotesFieldSchema,
  raw: string | null
): string {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (isShortTextField(field)) return raw
  if (isSingleSelectField(field)) {
    const opt = findOption(field, raw)
    return opt ? opt.title : `${raw} (legacy)`
  }
  return String(raw)
}

export function formatCustomAnswers(
  schema: NotesJsonSchema | null,
  notesJson: NotesJson
): Array<{ label: string; value: string }> {
  if (!schema) return []
  const out: Array<{ label: string; value: string }> = []
  for (const { key, field } of fieldsInOrder(schema)) {
    const raw = notesJson[key]
    if (raw === null || raw === undefined || raw === '') continue
    out.push({ label: field.title, value: renderFieldValue(field, raw) })
  }
  return out
}
```

Used by:

- `GuestList`/`GroupBlock` per-guest custom columns (uniform: iterate `guestNotesSchema`).
- `GuestDetailModal` header rows (uniform).
- `GuestDetailModal` events-table dynamic cell (heterogeneous: each row's event has its own schema).
- Merged Log custom-answers cell (heterogeneous).
- CSV export (`listResponses`): `;`-joined `label: value` pairs in a single cell.

The "core columns | divider | custom columns/cell" rule from the prior plan is unchanged. The `customDivider` CSS class still applies to the first custom `<th>`/`<td>`.

## Merged Log

The two stacked tables in `routes/Log.tsx` collapse into one chronological table with a Type column.

### UI

| Time | Type | Guest | Subject | Status / Notes | Custom answers | Responded by |
|------|------|-------|---------|----------------|----------------|--------------|
| 2026-05-03 14:32 | RSVP | Alice Searls | Wedding ceremony | attending | Meal choice: Chicken | Alice Searls |
| 2026-05-03 14:32 | Guest profile | Alice Searls | — | (none) | Dietary: vegetarian | Alice Searls |

Columns:

- **Time**: `responded_at`, formatted with `toLocaleString()`.
- **Type**: `RSVP` or `Guest profile` badge.
- **Guest**: `guest.display_name`.
- **Subject**: event name for RSVP rows; `—` for Guest profile rows.
- **Status / Notes**: status badge for RSVP rows; truncated `notes` for Guest profile rows; `—` if both empty.
- **Custom answers**: dynamic vertical list of `<label>: <value>` pairs from the row's schema (event schema for RSVP rows, `GUEST_PROFILE_NOTES_SCHEMA` for Guest profile rows). Empty cell rendered as `—`.
- **Responded by**: `responded_by_guest_id → display_name` or `—`.

The `customDivider` divider sits before the Custom answers column.

### Server (`responses.ts`)

Single action returning a uniform row shape:

```ts
export type LogRowKind = 'rsvp' | 'guest'

export interface AdminLogRow {
  id: string
  kind: LogRowKind
  respondedAt: string
  guestName: string
  subject: string | null            // event name for rsvp rows; null for guest rows
  status: 'attending' | 'declined' | null  // rsvp rows only
  notes: string | null              // guest rows only
  notesJson: NotesJson
  notesSchema: NotesJsonSchema | null  // schema for THIS row (event's or guest profile)
  respondedByDisplayName: string | null
}

export async function listLog(): Promise<{ rows: AdminLogRow[] }>
```

Implementation:

1. Query `rsvp_response` joined with `guest`, `event`, `responder` (as before in `listRsvpResponseLog`).
2. Query `guest_response` joined with `guest`, `responder`.
3. Load all events' `notes_schema` once → `Map<eventId, NotesJsonSchema | null>`.
4. Map each rsvp row to `{ kind: 'rsvp', subject: eventName, status, notes: null, notesSchema: eventSchemaMap.get(eventId) ?? null, ... }`.
5. Map each guest row to `{ kind: 'guest', subject: null, status: null, notes, notesSchema: GUEST_PROFILE_NOTES_SCHEMA, ... }`.
6. Concatenate, sort by `respondedAt DESC` (ties broken by id DESC).

The previous `listRsvpResponseLog` and `listGuestResponseLog` actions go away; one `listLog` replaces both.

### Client (`routes/Log.tsx`)

Rewritten as a single `Table`. State: `rows: AdminLogRow[]`. Columns per the table above. Uses `formatCustomAnswers(row.notesSchema, row.notesJson)` for the custom-answers cell.

Two sub-decisions deferred to implementation:

- **Filter chips** (RSVP / Guest profile / All) — useful but not required for v1. Default render shows all rows, sorted desc.
- **Pagination** — single-wedding scale (~hundreds of rows over months). Render all in one go.

## Editor UI alignment fix

The current `CustomFieldsEditor` renders three controls in a `FormGrid cols={3}` row: Label (text), Key (text), Type (select). The `<select>`'s native browser styling makes it shorter than the adjacent text inputs, producing visible misalignment. Fix this in implementation using the **frontend-design skill** to:

- Apply consistent height/padding to the `admin-input` class so `<input>` and `<select>` render at the same height.
- Audit the option row (`<input placeholder="Option label" />` next to `RemoveButton`) and the field footer for similar alignment issues.
- Verify on mobile-narrow widths (<480px) that the three-column row collapses gracefully.

The visual change is delegated to the frontend-design skill at implementation time; this design only flags the requirement.

## Zod 4 upgrade

Project-wide: `pnpm -r add zod@^4.0.0` (and `@hookform/resolvers` upgrade for compatibility).

### Breaking changes to audit

- `z.preprocess(fn, schema)` API — argument order unchanged in v4 but verify our `blankToNull` / `blankToUndef` preprocessors compile.
- `.email()`, `.url()` etc. moved off `z.string()` into top-level helpers (`z.email()`). Audit `adminGuestInputSchema.email`.
- `.refine` and `.transform` semantics largely unchanged.
- `z.record(keySchema, valueSchema)` — already two-arg in our v3 usage; v4 makes this required (we comply).
- `z.infer<>` works the same.
- `z.union` runtime mapping unchanged for our purposes (only ever calling `.safeParse`, never `toJSONSchema`).

Each `*.schema.ts` file gets a one-time pass; all errors caught by `pnpm typecheck`.

### Bundle impact

Zod 4 adds `z.mini` for tree-shakeable bundles. Default Zod 4 import is fine for our worker-side validation; the public-facing client bundle uses Zod for form validation against wire shapes only — manageable.

## Tests

### `packages/db/src/notesSchema.test.ts` (new)

- `parseNotesSchema(null)` → `null`.
- `parseNotesSchema('')` → `null`.
- `parseNotesSchema(stringifyNotesSchema(s)) === s` deep-equal round-trip.
- `fieldsInOrder` returns properties in `x-fieldOrder` order, even when JS object key order differs.
- `isShortTextField` / `isSingleSelectField` discriminators.
- `findOption` returns the matching option; null when missing.
- `buildNotesValidator(schema).safeParse(...)`:
  - Accepts a valid short_text answer (trimmed, ≤ maxLength).
  - Rejects a short_text exceeding maxLength.
  - Coerces empty short_text to null.
  - Accepts a single_select with a known option id.
  - Rejects a single_select with an unknown option id.
  - Rejects an unknown property key (strict).
  - Accepts missing keys (every field is optional).
  - Returns sanitized data on success.

### `packages/db/src/diff.test.ts` (updated)

- Drop tests of `validateNotesJson`.
- `canonicalNotesJson` / `diffRsvpResponse` / `diffGuestResponse` tests unchanged.

### `submitRsvp` (in `packages/frontend/`)

- First submission inserts one `rsvp_response` per submitted (guest, event); one `guest_response` per submitted guest.
- Re-submitting unchanged values inserts no rows.
- Status change → new `rsvp_response`.
- Single_select change → new `rsvp_response` with new `notes_json`.
- Unknown field key → 400 with `formatZodIssue` error body.
- Single_select value not in `oneOf` → 400.
- Submitting `notesJson` to an event with `notes_schema = null` → 400.
- Per-guest `dietary_restrictions` change → new `guest_response`.
- Sanitized output round-trips through reads.

### Custom-field admin (new `packages/rsvp/src/server/admin/events.test.ts`)

- Save event with two drafts (short_text + single_select with two options) → `event.notes_schema` contains canonical JSON Schema (assert via `parseNotesSchema`).
- Save event with empty drafts array → `notes_schema` is null.
- Update event removing one option → schema's `oneOf` array shrinks; existing answers in old rows untouched.
- Duplicate `key` across drafts → 400 (refine error).
- Duplicate `const` within `oneOf` → 400.
- Invalid `key` (uppercase, hyphen) → 400.

### `packages/rsvp/src/schema.test.ts`

- Drop tests of removed schemas.
- New: `adminFieldDraftSchema` parses both short_text and single_select shapes.
- New: `adminEventInputSchema.notesSchema` accepts an empty array; rejects duplicate keys.

### Log page

- `listLog` returns rows from both tables, ordered by `respondedAt DESC`.
- A row's `notesSchema` matches the event's schema (rsvp rows) or `GUEST_PROFILE_NOTES_SCHEMA` (guest rows).
- Empty `notes_json` renders the custom-answers cell as `—`.

## Build sequence

1. **Zod 4 upgrade.** Bump dependency in every package that imports zod (`packages/rsvp`, `packages/frontend`, `packages/db` once it adopts zod). Fix any breakage in `pnpm typecheck`.
2. **Migration + Database type.** Edit `0001_init.sql`: drop the four custom-field tables, drop their seeds, add `event.notes_schema`. Update `packages/db/src/schema.ts`. Wipe local dev DB.
3. **Core module.** Add `packages/db/src/notesSchema.ts` and `guestProfileSchema.ts` with full unit tests. Wire through `packages/db/src/index.ts`. At this point nothing else in the project compiles — the next steps unblock it.
4. **Cleanup deletes.** Delete `packages/rsvp/src/server/admin/customFields.ts`, the four `loadEventCustomFields`/`loadGuestCustomFields` references, the four schema/type exports in `rsvp/schema.ts`. The project still doesn't compile; that's expected.
5. **Frontend wire shapes.** Update `packages/frontend/src/schema.ts` and `packages/frontend/src/server/rsvp.ts` (`getRsvpGroup`, `submitRsvp`). Use `buildNotesValidator` and `parseNotesSchema`. Public form components rerendered against the new shape. Public RSVP path passes typecheck and tests.
6. **Admin edit.** Rewrite `adminEventInputSchema`, `events.ts` (`saveEvent`/`listEvents`), and `CustomFieldsEditor.tsx` against `AdminFieldDraft[]`. Drop the "Guest profile fields" section in `EventSettings.tsx`. Admin can create/edit events with custom fields.
7. **Admin display.** Rewrite `customFieldRender.ts` and consumers (`GuestDetailModal`, `GroupBlock`/`GuestList`, CSV exporter). Verify the divider rule still holds visually.
8. **Merged Log.** Replace `listRsvpResponseLog`/`listGuestResponseLog` with `listLog`. Rewrite `routes/Log.tsx` as a single table.
9. **Frontend-design pass on `CustomFieldsEditor`.** Resolve the input/select alignment issue. Audit on mobile widths.
10. **Smoke run.** `pnpm dev`. Public RSVP with event meal-choice (single_select) + dietary (short_text) → rows in Log. Admin edit event's custom fields → public form picks up the change. Verify Log Type badges, Custom answers cell, divider.

Each step ends with `pnpm typecheck && pnpm test && pnpm lint` green.

## Failure modes

- **Hand-edited bad JSON in `event.notes_schema`** — `parseNotesSchema` throws. Read paths (`getRsvpGroup`, admin reads, Log) catch and surface a 500 with a clear "Event schema is malformed" message; admin can clear via the editor (re-save with empty drafts → null). Future hardening: validate the schema document against a meta-schema before save.
- **Orphaned `notes_json` keys** — admin removes a field from the schema; old `notes_json` rows still hold values for that key. Reads tolerate orphans (skip keys not in schema). Could surface as `(unknown field)` in the Log, opt-in.
- **Type-changed field with stale answers** — answers from the prior type render as `(legacy)` raw text. No data loss. Documented behaviour.
- **Duplicate `const` across edits** — refined at admin-input time; cannot reach storage.
- **Concurrent submissions** — append-only behaviour from the previous plan stands: two browsers sharing an invite code can insert near-simultaneous rows for the same (guest, event); both are kept; latest by `responded_at` wins (ties broken by `id`).
- **Migration drift** — pre-launch wipe is acceptable.
- **Zod 4 union behaviour for single_select with one option** — `z.union([...])` requires at least two members. `buildNotesValidator` builds `z.literal(...)` directly when there's a single option, `z.union([...])` otherwise.
- **Empty schema vs. null `notes_schema`** — saving zero drafts writes `notes_schema = NULL`. Saving a schema with empty `properties` is invalid (rejected upstream). The two are equivalent for readers: both mean "no custom fields".

## Architecture summary

```
                       ┌──────────────────────────────┐
                       │ packages/db/src/notesSchema.ts │
                       │  types  parseNotesSchema       │
                       │         stringifyNotesSchema   │
                       │         fieldsInOrder          │
                       │         buildNotesValidator    │
                       │         findOption             │
                       │  is{ShortText,SingleSelect}    │
                       └───────────────▲──────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
   admin write                    public/admin                    submitRsvp
   ─────────                      reads                           ─────────
   AdminFieldDraft[]              fieldsInOrder()                 buildNotesValidator()
   → schemaToDrafts() ↔ stringifyNotesSchema()                    → safeParse()
        │                              │                              │
        ▼                              ▼                              ▼
   event.notes_schema            renders form                    inserts validated
   (TEXT)                        & admin display                 notes_json rows
```

The JSON Schema is the only thing that knows what fields exist. Every other layer parses, walks, or validates against it.
