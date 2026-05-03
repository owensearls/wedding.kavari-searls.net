# Append-Only RSVP Responses with Configurable Custom Fields

The public-facing RSVP API becomes the only mutator of guest answers, and it is append-only. Every public submission either inserts new rows or inserts nothing — never updates or deletes. The current ad-hoc fields (meal choice, dietary restrictions, song request) are reframed as **admin-configurable custom fields** with two input types (`short_text`, `single_select`). Admin gets a "Log" tab that lists raw rows from the new append-only tables.

## Goals

- Public API only inserts. No `UPDATE`, no `DELETE`, no upserts.
- Two append-only tables: `rsvp_response` (per guest/event) and `guest_response` (per guest profile).
- Latest row wins for current-state reads.
- Per-event custom fields (today's "meal options" generalized) and global guest-level custom fields (today's dietary/song request generalized) are admin-configurable, with a uniform `{ short_text, single_select }` model.
- `notes_json` on each response table stores answers keyed by the field's `key`. The frontend renders the form purely from the config.
- Free-text `notes` (the "Anything else we should know?" textarea) stays as a hardcoded long-text column on `guest_response.notes`. It is *not* a custom field.
- Admin gains a "Log" tab; admin views render custom fields to the right of core columns separated by a visual divider.

## Out of scope

- Admin editing of public-supplied answers. Admin remains a pure reader of `rsvp_response` and `guest_response`. (Today's admin form silently clobbers dietary/notes on every save — fixed in passing by removing the columns and form fields entirely.)
- Reverting an RSVP from `attending`/`declined` back to undecided. The form has no UI for it. Absence of a row ⇒ pending; `status='pending'` is removed from the schema.
- Custom-field types beyond `short_text` and `single_select` (e.g., long_text, checkbox, number, date). The schema's `type` column accommodates more, but the form/admin UI ships only the two.
- Required-vs-optional, validation rules beyond hardcoded type defaults (short_text ≤ 500 chars; single_select must reference an existing option id).
- Conditional visibility (e.g., "show field X only when status=attending"). The current "show meal only when attending" behaviour stays hardcoded for now (see "Public form rendering"). True conditional fields are future.
- Migrating any production data — pre-launch, single consolidated migration.

## Schema (single consolidated migration)

Edit `packages/db/migrations/0001_init.sql` in place. Local dev wipes via `pnpm clean && pnpm db:migrate:local`; remote D1 is wiped before next deploy.

### Removed

- `meal_option` table — replaced by `event_custom_field_option`.
- `event.requires_meal_choice` column — derived from "does this event have any custom fields?". The form just renders whatever fields exist.
- `guest.dietary_restrictions`, `guest.notes`, `guest.notes_json` columns — moved into `guest_response`.
- `rsvp` table — replaced by `rsvp_response`.

### Append-only response tables

```sql
-- One row per (guest, event) per public submit, when something changed.
-- Latest row by responded_at is current state. Absence ⇒ pending.
CREATE TABLE rsvp_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'declined')),
  notes_json TEXT,                       -- { [fieldKey]: optionId | textValue }
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_rsvp_response_guest_event_at
  ON rsvp_response(guest_id, event_id, responded_at);

-- One row per guest per public submit, when something changed.
CREATE TABLE guest_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  notes TEXT,                            -- hardcoded long-text "anything else?" field
  notes_json TEXT,                       -- { [fieldKey]: optionId | textValue }
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_guest_response_guest_at
  ON guest_response(guest_id, responded_at);
```

### Custom-field configuration tables

```sql
-- Per-event custom field config (replaces meal_option's role).
CREATE TABLE event_custom_field (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                     -- snake_case, used as notes_json key
  label TEXT NOT NULL,                   -- displayed to public + admin
  type TEXT NOT NULL CHECK (type IN ('short_text', 'single_select')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, key)
);
CREATE INDEX idx_event_custom_field_event ON event_custom_field(event_id, sort_order);

-- Options for single_select event fields. Stable ids let answers survive renames.
CREATE TABLE event_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES event_custom_field(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_event_custom_field_option_field
  ON event_custom_field_option(field_id, sort_order);

-- Global guest-level custom field config.
-- Applies to every guest in the party (no per-guest scoping; song-request being
-- "primary only" was a UI quirk we're dropping for uniformity).
CREATE TABLE guest_custom_field (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('short_text', 'single_select')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_guest_custom_field_sort ON guest_custom_field(sort_order);

CREATE TABLE guest_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES guest_custom_field(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_guest_custom_field_option_field
  ON guest_custom_field_option(field_id, sort_order);
```

### Seed defaults (in the same migration)

```sql
-- Default global guest-level custom fields. Admin can edit/remove via UI.
INSERT INTO guest_custom_field (id, key, label, type, sort_order) VALUES
  ('gcf_dietary',      'dietary_restrictions', 'Dietary restrictions or allergies', 'short_text', 0),
  ('gcf_song_request', 'song_request',         'Song request',                       'short_text', 1);
```

(No event seed — admins create events and add custom fields per event.)

### `Database` type (`packages/db/src/schema.ts`)

Replace `RsvpTable` and `MealOptionTable`. Add `RsvpResponseTable`, `GuestResponseTable`, `EventCustomFieldTable`, `EventCustomFieldOptionTable`, `GuestCustomFieldTable`, `GuestCustomFieldOptionTable`. Trim `GuestTable` and `EventTable`.

## `notes_json` shapes

Driven by configuration; not a fixed shape:

```ts
type NotesJsonValue = string | null  // option id for single_select, raw text for short_text
type NotesJson = Record<string /* field.key */, NotesJsonValue>
```

For today's seeded defaults, the `guest_response.notes_json` shape is:

```ts
{
  dietary_restrictions?: string | null   // short_text
  song_request?:        string | null    // short_text — single string, not {title, artist}
}
```

For an event with a meal-choice single_select, `rsvp_response.notes_json` looks like:

```ts
{
  meal_choice?: string | null   // option id from event_custom_field_option
}
```

The dropped `songRequest: { title, artist }` shape collapses into a single `song_request` string. The form's two inputs combine into one.

## Custom-field configuration wire shape

Server actions return field configs alongside the data. The frontend uses these to drive form rendering and admin column rendering — no hardcoded knowledge of which fields exist.

```ts
// shared shape, returned wherever custom fields are needed
export interface CustomFieldOption {
  id: string
  label: string
  description: string | null
}

export interface CustomFieldConfig {
  id: string
  key: string                              // snake_case, notes_json key
  label: string
  type: 'short_text' | 'single_select'
  sortOrder: number
  options: CustomFieldOption[]             // empty for short_text
}

// extend EventDetails (frontend schema)
export interface EventDetails {
  // ... existing fields
  customFields: CustomFieldConfig[]        // replaces mealOptions + requiresMealChoice
}

// extend RsvpGroupResponse
export interface RsvpGroupResponse {
  // ... existing fields
  guestCustomFields: CustomFieldConfig[]   // global guest-level config
}
```

`requiresMealChoice` and `mealOptions` come out of the wire shape entirely. The form looks at `event.customFields` and renders whatever's there.

## Read model

Helpers in `packages/db/src/db.ts` (or new `packages/db/src/latest.ts`):

- `latestRsvpResponses(db, { guestIds?, eventIds? })` — `ROW_NUMBER() OVER (PARTITION BY guest_id, event_id ORDER BY responded_at DESC) = 1`. D1/SQLite supports window functions; correlated-subquery fallback documented in "Failure modes".
- `latestGuestResponses(db, { guestIds })` — partitioned by `guest_id`.
- `loadEventCustomFields(db, eventIds)` — returns `Map<event_id, CustomFieldConfig[]>`, joining `event_custom_field` and `event_custom_field_option` and grouping in app code.
- `loadGuestCustomFields(db)` — returns `CustomFieldConfig[]` for the global guest-level config.

Callers:

- `getRsvpGroup` (`packages/frontend/src/server/rsvp.ts`) — pulls latest `rsvp_response` per (guest, event), latest `guest_response` per guest, plus event/guest custom-field configs. Returns the merged `RsvpGroupResponse`.
- `listGroups`, `getGroup`, `getGuest`, `listResponses` (admin) — read latest rows for status/profile display. Resolve single_select labels by looking up option ids in a Map built once per request.

## Public mutation (`submitRsvp`)

`packages/frontend/src/server/rsvp.ts:submitRsvp` rewrites:

1. Validate the submission shape (`respondedByGuestId` in party, every (guestId, eventId) belongs to the party + invited event).
2. Load: party guest ids, event invitations, event custom-field configs (with options), guest custom-field configs (with options), latest `rsvp_response` per submitted (guest, event), latest `guest_response` per submitted guest.
3. **Per-event answers**, for each submitted `(guestId, eventId, status, notesJson)`:
   - Skip if `status === 'pending'`.
   - Validate `notesJson` against the event's `customFields`:
     - Reject keys not in the config.
     - For `single_select` keys, reject values that aren't ids in `event_custom_field_option`.
     - For `short_text`, trim and enforce ≤500 chars; coerce empty → `null`.
   - Compare with latest row: if `status` differs OR canonical-stringified `notes_json` differs OR no latest row → INSERT new row.
4. **Per-guest answers**, for each submitted guest:
   - Validate `notes_json` against the global `guestCustomFields` config (same rules).
   - Validate `notes` ≤500 chars (current zod limit).
   - Compare with latest row: if `notes` differs OR canonical-stringified `notes_json` differs → INSERT new row.
5. Return `{ ok: true, respondedAt: nowIso() }` regardless of insertion (sparse writes; an unchanged re-submit is a no-op).

Removed: the upsert into `rsvp`, the `UPDATE guest SET dietary_restrictions=…` block, the trailing `UPDATE guest SET updated_at` for the leader.

Wire-shape note: `RsvpSubmission` carries `notesJson` directly per (guest, event) and per guest. The form is responsible for building it from its rendered inputs.

## Admin mutation (no append-only writes)

`saveGroup` (`packages/rsvp/src/server/admin/groups.ts`) becomes purely structural. Drop `dietaryRestrictions` and `notes` from `adminGuestInputSchema` and `EditGroupForm`'s blank defaults; remove the `UPDATE guest` writes for those fields. `getGroup` and `getGuest` read `notes`/`notes_json` from latest `guest_response`. Admin doesn't write to either append-only table.

## Custom-field admin UI

Custom-field configuration lives on the existing **Events** admin page. Two sections:

### 1. Global guest-level custom fields (top of the Events page)

A new section above the events list titled "Guest profile fields". Renders the rows from `guest_custom_field` (default-seeded with dietary/song request) with controls to:

- Add a field — label input, type select (`Short text` / `Single select`), key auto-generated as a snake_case slug of the label with admin override.
- Reorder via drag handle (writes `sort_order`).
- Edit label/type. Type changes are restricted: `short_text → single_select` allowed (existing string answers survive but no longer match an option id, so they render as raw value with a "(legacy text)" tag); `single_select → short_text` allowed.
- For `single_select`: manage options (add/remove/reorder/edit label + description). Option ids are stable (`newId('cfo')`) so existing `notes_json` references survive renames.
- Delete — confirms; cascades to options. Existing answers in `notes_json` keyed by the deleted field stay in the response rows but stop rendering anywhere (orphaned keys are tolerated in reads).

New server actions in `packages/rsvp/src/server/admin/custom_fields.ts`:

- `listGuestCustomFields()` → `CustomFieldConfig[]`
- `saveGuestCustomField(input)` — upsert with options diff
- `deleteGuestCustomField(id)`

Admin schema (`packages/rsvp/src/schema.ts`):

```ts
export const adminCustomFieldOptionInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(200),
  description: z.preprocess(blankToNull, z.string().max(500).nullable().optional()),
  sortOrder: z.number().int().default(0),
})

export const adminCustomFieldInputSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(200),
  type: z.enum(['short_text', 'single_select']),
  sortOrder: z.number().int().default(0),
  options: z.array(adminCustomFieldOptionInputSchema).default([]),
}).refine(
  (d) => d.type === 'single_select' || d.options.length === 0,
  { message: 'Options only allowed for single_select fields', path: ['options'] }
)
```

### 2. Per-event custom fields (inside the event edit form)

Replace the existing `mealOptions` section in `EditEventForm.tsx` and on the `AdminEventInput` schema with a generic "Custom fields" section. Same UI as section 1 but scoped to the event being edited; field keys are unique per event (not globally).

`saveEvent` no longer writes `requires_meal_choice` or to `meal_option`. Custom-field add/edit/delete go through:

- `saveEventCustomField(eventId, input)`
- `deleteEventCustomField(id)`

Or, if simpler for the form's submit, `saveEvent` accepts the customFields array as part of the event payload and the server diffs/upserts.

### Data migration for existing meal options

Pre-launch wipe + recreate. After re-running migrations, an admin recreates meal-choice fields per event using the new UI.

## Public form rendering (config-driven)

`RsvpFull.tsx` and `EventCardEditor.tsx`:

- For each event in `data.events`: render the status radios (existing behaviour, hardcoded), then for each entry in `event.customFields` render an input by `type`:
  - `short_text` → `<input type="text">`, `maxLength={500}`.
  - `single_select` → `<select>` with `<option>` per `field.options`.
- The "show meal only when attending" rule generalizes to "show all event custom fields only when status === 'attending'". Declined responses don't carry custom values. (If/when we want fields visible while declined, a per-field `visibleWhen` setting can be added later.)
- For each guest, in the "Other details" block, render `data.guestCustomFields` for that guest (same dispatch). Then render the hardcoded long-text "Anything else we should know?" textarea (`guest_response.notes`) — this stays primary-guest-only, matching today.
- Form state shape moves from `{ rsvps: { [k]: { status, mealChoiceId } }, dietary, songs, notes }` to `{ rsvps: { [k]: { status, notesJson } }, guestNotesJson, guestNotes }`. The `rsvpFormState` builder seeds initial values from latest responses.
- Submit packs `notesJson` per (guest, event) and per-guest `notesJson` + `notes` directly — no key translation in the client.

## Admin UI ↔ DB mapping (after refactor)

| Surface / element | Source |
|---|---|
| **GuestList outer table** | |
| Name | `guest.display_name` |
| Invite code (link) | `guest.invite_code` |
| Per-event status badge | latest `rsvp_response.status` for (guest, event) |
| Notes column (core) | latest `guest_response.notes` |
| Per-guest custom columns (after divider) | latest `guest_response.notes_json[field.key]`, one column per `guest_custom_field` |
| Edit icon | opens `EditGroupForm` (structural only) |
| **GuestDetailModal header** | |
| Group / Invite / Email / Phone | `guest.{group_label of leader, invite_code, email, phone}` |
| Notes (core) | latest `guest_response.notes` |
| Per-guest custom rows (after divider) | latest `guest_response.notes_json[field.key]`, one row per `guest_custom_field` |
| **GuestDetailModal events table** | |
| Event / Status / Responded / By | `event.name`, latest `rsvp_response.{status, responded_at, responded_by_guest_id→display_name}` |
| Per-event custom cell (after divider) | latest `rsvp_response.notes_json` rendered against that event's `event_custom_field` config (dynamic per row) |
| **Log RSVP table** | every `rsvp_response`; core columns + divider + dynamic custom cell per row |
| **Log Guest table** | every `guest_response`; core columns + divider + one column per `guest_custom_field` |
| **Events admin page** | `event.*` (no `requires_meal_choice`); Custom fields section sources from `event_custom_field` + `event_custom_field_option`; Guest profile fields section sources from `guest_custom_field` + `guest_custom_field_option` |

## Custom-field display rule

A "custom" field is any value in a `notes_json` blob; "core" fields are top-level SQL columns. In every admin tabular surface:

```
[ core columns ] | divider | [ custom columns or one dynamic cell ]
```

Implementation: CSS class `customDivider` applied to the first `<th>` and `<td>` in the custom group, rendering as a strong left border. Same in the modal events table, the Log tables, and the outer GuestList row.

For per-event custom fields, the table layout depends on uniformity:

- **Uniform** (every row's event has the same field set): one column per field. E.g., a Log filtered by event.
- **Heterogeneous** (rows belong to different events with different field configs): a single dynamic "Custom answers" cell per row, formatted as a vertical list of `<field-label>: <value>` pairs. E.g., the unfiltered Log RSVP table and the modal events table.

For per-guest custom fields, the configuration is global, so columns are uniform across rows: one column per `guest_custom_field`.

## Admin "Log" tab

Top nav becomes `Guests | Events | Log`. New route `/admin/log/` rendered by `packages/rsvp/src/admin/log.tsx`, wrapped in `AdminShell` with `current="log"`. The `AdminShellProps['current']` union grows to `'guests' | 'events' | 'log'`.

Routing: one entry in the `rscStaticPages` plugin map in `packages/rsvp/vite.config.ts:24-30`:

```ts
rscStaticPages({
  pages: {
    '/': './src/admin/index.tsx',
    '/events/': './src/admin/events.tsx',
    '/import/': './src/admin/import.tsx',
    '/log/': './src/admin/log.tsx',   // new
  },
}),
```

Page layout (`packages/rsvp/src/admin/routes/Log.tsx`): two tables stacked, newest-first.

**RSVP responses table** (heterogeneous per-event):
- Core: Timestamp, Guest, Event, Status, Responded by.
- Divider.
- Custom answers (one cell per row, dynamic): vertical list of `<event-field-label>: <resolved value>` pairs.

**Guest responses table** (uniform global config):
- Core: Timestamp, Guest, Notes, Responded by.
- Divider.
- One column per `guest_custom_field`, rendering the resolved value.

Server actions in `packages/rsvp/src/server/admin/responses.ts`:

- `listRsvpResponseLog()` — every `rsvp_response`, joined to guest/event/responder, with parsed `notesJson` and the matching event's custom-field config + option lookup. Ordered by `responded_at DESC`.
- `listGuestResponseLog()` — every `guest_response`, joined to guest/responder, with parsed `notesJson` and the global `guestCustomFields` config + option lookup. Ordered by `responded_at DESC`.

The existing `listResponses` (used by the CSV exporter) keeps its current "current state per (guest, event)" semantics, internally rewritten to use `latestRsvpResponses`. CSV columns: timestamp + core + dynamic per-event custom answers serialized as `key=value;key=value` in a single cell (heterogeneous; columns can't be uniform).

## Other admin surfaces

- **`GuestDetailModal`** — header detail-grid: core rows (Group, Invite, Email, Phone, Notes), divider, per-guest custom rows iterated from `guestCustomFields`. Drop the separate "Song request" section below the events table; song request is a regular guest custom field rendered in the header. The events table inside the modal: core columns + divider + dynamic "Custom answers" cell per row. `getGuest` returns the global guest config and per-event configs as part of the payload.
- **`GroupBlock` / `GuestList`** — drop the inline `· {mealLabel}` hint inside per-event status cells. Add columns to the right of all event columns, after a divider, one per `guest_custom_field`. The "Notes" column shows `guest_response.notes` only (core). Schema additions:
  - `AdminGroupListGuest` adds `notes` (core), `notesJson: Record<string, string|null>` (custom answers).
  - `AdminGroupListItem` carries the global `guestCustomFields` so the renderer knows which columns to draw.
  - `AdminGuestEventStatus` drops `mealLabel`, gains `notesJson` (the row's parsed `rsvp_response.notes_json`). The renderer resolves option labels using a `Map<optionId, label>` built from the events' configs.

## Latent bug fixed in passing

Today's `saveGroup` writes `dietary_restrictions=null, notes=null` on every admin edit because `EditGroupForm` defaults those fields to `''` and never surfaces inputs for them (`EditGroupForm.tsx:27-28`). Removing the columns from `guest` and removing the fields from `adminGuestInputSchema` makes the bug structurally impossible.

## Tests

- `packages/db/src/db.test.ts` — schema-touch updates; new tests for `latestRsvpResponses`, `latestGuestResponses`, `loadEventCustomFields`, `loadGuestCustomFields`.
- `submitRsvp` (in `packages/frontend/`):
  - First submission inserts one row per (guest, event) with answers; one `guest_response` row with `notes_json`.
  - Re-submitting unchanged values inserts no rows.
  - Changing only status → new `rsvp_response` row.
  - Changing only meal (single_select) → new `rsvp_response` row with new `notes_json.meal_choice`.
  - Submitting an unknown field key → 400.
  - Submitting a `single_select` value that isn't an option id → 400.
  - Changing only `dietary_restrictions` → new `guest_response` row.
  - Reading after edits returns latest values.
- Custom-field admin actions:
  - Save event with two custom fields, options diff (insert/update/delete).
  - Delete a single_select option referenced by an existing answer — option removed; renderer treats orphaned id as raw value (no crash).
- `packages/rsvp/src/schema.test.ts` — adjust for renamed/dropped admin fields.

## Build sequence

1. **DB schema + types.** Migration with all new tables + dropped tables, `Database` type, helpers (`latestRsvpResponses`, `latestGuestResponses`, `loadEventCustomFields`, `loadGuestCustomFields`) with unit tests.
2. **Public path.** Rewrite `submitRsvp` and `getRsvpGroup` to read/write the new tables and return config-driven payloads. Update the wire schemas and `RsvpFull.tsx` / `EventCardEditor.tsx` to render dynamically. Tests pass on the public path with a hand-seeded event custom field.
3. **Admin reads.** Update `listGroups`, `getGroup`, `getGuest`, `listResponses` to use the latest helpers and return parsed `notesJson` plus configs; trim `saveGroup`, `adminGuestInputSchema`, `EditGroupForm` defaults.
4. **Admin custom-field config UI.** Server actions (`listGuestCustomFields`, `saveGuestCustomField`, `deleteGuestCustomField`, plus event-scoped equivalents) and the Events page sections. `saveEvent` stops writing `requires_meal_choice` / `meal_option`.
5. **Admin display surfaces.** Apply the divider rule and dynamic custom-field rendering to `GuestDetailModal`, `GroupBlock` / `GuestList`. Drop the inline meal hint and the bottom song-request section.
6. **Log tab.** New route `/admin/log/`, `Log.tsx`, `listRsvpResponseLog` / `listGuestResponseLog` actions, `AdminShell` nav entry.
7. **Smoke run.** `pnpm dev`. Public RSVP flow with event meal-choice + dietary + song request → rows in Log; admin add a new global custom field ("Bringing a kid?") → public form re-renders; admin edit an event's custom fields → public form picks up the change. Visually confirm the divider sits between core and custom columns everywhere.

## Failure modes

- **Concurrent submissions** — two browsers sharing an invite code can insert near-simultaneous rows for the same (guest, event). Both kept; latest by `responded_at` wins. Ties broken by row order (or `id`).
- **Migration drift** — editing `0001_init.sql` in place requires wiping local and remote D1. Pre-launch this is acceptable.
- **Window-function support** — D1's SQLite supports `ROW_NUMBER()`. If a Kysely+kysely-d1 incompatibility surfaces, fall back to correlated subqueries (`responded_at = (SELECT MAX(...) FROM ... WHERE ...)`). Single-wedding scale.
- **Orphaned `notes_json` keys** — if admin deletes a custom field, response rows still hold values for that field's key. Reads tolerate orphans (skip keys that don't match any current config). The Log can show a "(unknown field)" label rather than dropping the value, so it's visible that data exists.
- **Type changes that break existing answers** — switching a field from `short_text` to `single_select` leaves prior text values that aren't valid option ids. The renderer treats them as raw text with a "(legacy)" tag. No data loss; admin can clear them by deleting and re-creating the field.
