# Append-Only RSVP Responses

The public-facing RSVP API is the only mutator of guest answers, and it should be append-only. Every public submission either inserts new rows or inserts nothing — never updates or deletes. Admin gets a "Log" tab that lists the raw rows from those tables.

## Goals

- Public API only inserts. No `UPDATE`, no `DELETE`, no upserts.
- Two append-only tables, one for per-(guest, event) responses, one for per-guest profile answers.
- Latest row wins for current-state reads.
- `notes_json` columns absorb the previously-typed fields (`meal_choice_id`, `dietary_restrictions`) and become the extension point for future per-event-type custom inputs.
- Admin gains a "Log" tab that shows every row in both append-only tables, newest first.

## Out of scope

- Admin editing of public-supplied answers. Today's admin form silently clobbers dietary/notes on every save (see "Latent bug fixed in passing" below); we remove the bug by removing the columns and inputs, not by adding admin write paths into the new tables.
- Reverting an RSVP from `attending`/`declined` back to undecided. The form has no UI for this. We treat absence-of-row as pending; status `'pending'` is removed from the schema. If we need this later we add a `'pending'` insert path.
- Per-event custom-input authoring. The `notes_json` shape is the seam for it; the authoring UI is a future extension.
- Renaming or restructuring the existing `event`, `invitation`, `meal_option` tables.

## Schema (single consolidated migration)

Pre-launch: edit `packages/db/migrations/0001_init.sql` in place. Local dev is wiped via `pnpm clean && pnpm db:migrate:local`. Remote D1 is wiped (or recreated) before next deploy.

```sql
-- ── rsvp_response (renamed from rsvp; append-only) ─────────────────────
-- Many rows per (guest_id, event_id) over time. Latest row by responded_at
-- is the current state. Absence of any row = pending (no 'pending' status).
-- meal_choice_id moves into notes_json so it can grow into other per-event
-- custom inputs without a schema change.
CREATE TABLE rsvp_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'declined')),
  notes_json TEXT,                 -- { mealChoiceId, ...future per-event fields }
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_rsvp_response_guest_event_at
  ON rsvp_response(guest_id, event_id, responded_at);

-- ── guest_response (new; append-only) ──────────────────────────────────
-- Per-guest profile answers from the public form. dietary_restrictions
-- moves into notes_json alongside the existing songRequest shape.
-- Free-text `notes` stays as a top-level column.
CREATE TABLE guest_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  notes TEXT,
  notes_json TEXT,                 -- { dietary, songRequest, ...future party-wide fields }
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_guest_response_guest_at
  ON guest_response(guest_id, responded_at);

-- ── guest table loses three columns ────────────────────────────────────
-- Drop dietary_restrictions, notes, notes_json. The guest row keeps only
-- structural/admin-managed fields: id, party_leader_id, first_name,
-- last_name, display_name, email, phone, invite_code, group_label,
-- created_at, updated_at.
```

`packages/db/src/schema.ts` mirrors the migration: replace `RsvpTable` with `RsvpResponseTable`, add `GuestResponseTable`, drop the three columns from `GuestTable`, add the new tables to the `Database` map.

### `notes_json` shapes

```ts
// rsvp_response.notes_json
{
  mealChoiceId?: string | null
  // passthrough; future per-event custom fields live here
}

// guest_response.notes_json
{
  dietary?: string | null
  songRequest?: { title: string; artist?: string | null }
  // passthrough; future party-wide custom fields live here
}
```

The wire shapes in `packages/frontend/src/schema.ts` keep `mealChoiceId` and `dietaryRestrictions` as top-level fields. The server flattens between the wire shape and `notes_json` at the storage boundary so the form code is unchanged.

## Read model

Two helpers added in `packages/db/src/db.ts` (or a new `packages/db/src/latest.ts`):

- `latestRsvpResponses(db, { guestIds?, eventIds? })` — returns one row per (guest_id, event_id), the most-recent by `responded_at`. Implemented with `ROW_NUMBER() OVER (PARTITION BY guest_id, event_id ORDER BY responded_at DESC) = 1` (D1/SQLite supports window functions).
- `latestGuestResponses(db, { guestIds })` — same shape, partitioned by `guest_id`.

Callers updated to use these helpers instead of `selectFrom('rsvp')`/reading guest profile columns:

- `getRsvpGroup` (`packages/frontend/src/server/rsvp.ts`) — pulls latest `rsvp_response` per (guest, event) for the party; pulls latest `guest_response` per guest; merges into the `RsvpGroupResponse` shape the form expects (extracting `mealChoiceId` from `rsvp_response.notes_json`, `dietary`/`songRequest` from `guest_response.notes_json`).
- `listGroups`, `getGroup`, `getGuest` (`packages/rsvp/src/server/admin/{groups,guests}.ts`) — read latest rows for status/meal/dietary/notes display. Meal labels still resolve via `meal_option` lookup using the extracted `mealChoiceId`.
- `listResponses` (the existing CSV-export source) — keeps its current "current state per (guest, event)" semantics, internally rewritten to use `latestRsvpResponses`.

## Public mutation (`submitRsvp`)

`packages/frontend/src/server/rsvp.ts:submitRsvp` rewrites:

1. Validate as today.
2. Load latest `rsvp_response` per submitted `(guestId, eventId)` and latest `guest_response` per submitted `guestId` in two batched queries.
3. For each submitted RSVP `(guestId, eventId, status, mealChoiceId)`:
   - Skip if `status === 'pending'` (the form's default; not a user choice).
   - Build `nextNotesJson = { mealChoiceId: status === 'attending' ? (mealChoiceId ?? null) : null }`.
   - If no latest row, OR `latest.status !== status`, OR extracted `latest.notes_json.mealChoiceId !== nextNotesJson.mealChoiceId` → `INSERT INTO rsvp_response`.
4. For each submitted guest profile update:
   - Build `nextNotes = (notes ?? null)` and `nextNotesJson = { dietary: dietary ?? null, songRequest: songRequest ?? null }` (preserving any passthrough keys that exist on the latest row but aren't form-managed).
   - If no latest row, OR `latest.notes !== nextNotes`, OR `latest.notes_json` not deep-equal to `nextNotesJson` → `INSERT INTO guest_response`.
5. Return `{ ok: true, respondedAt: nowIso() }` regardless of whether any rows were inserted (sparse writes; an unchanged form re-submit is a no-op).

Removed in this rewrite:

- `onConflict … doUpdateSet` upsert into `rsvp`.
- `UPDATE guest SET dietary_restrictions=…, notes=…, notes_json=…` block.
- Trailing `UPDATE guest SET updated_at=…` for the leader (loses meaning under append-only; leader's `updated_at` becomes purely admin-driven).

## Admin mutation (no append-only writes)

Admin is **not** a writer of either append-only table. `saveGroup` (`packages/rsvp/src/server/admin/groups.ts`) becomes purely structural:

- Drop `dietaryRestrictions` and `notes` from `adminGuestInputSchema` (`packages/rsvp/src/schema.ts`).
- Remove the corresponding fields from the `INSERT/UPDATE guest` calls in `saveGroup`.
- `getGroup` reads dietary/notes from latest `guest_response` for display (admin currently doesn't display these on the edit form, but `EditGroupForm`'s blank-defaults need to be cleaned out so they don't reappear).

`getGuest` (`packages/rsvp/src/server/admin/guests.ts`) reads `dietaryRestrictions`/`notes`/`notesJson` from latest `guest_response` for the GuestDetailModal display.

## Custom-field display rule

A "custom" field is any value stored inside a `notes_json` blob. A "core" field is a top-level SQL column. Custom fields are the seam for future per-event-type customization (the goal stated in the brief), so admin views must:

- Render every known custom field, not just the ones that exist today.
- Place custom columns to the right of all core columns.
- Visually separate core from custom with a divider — implemented as a stronger left border on the first custom column (CSS class `customDivider` on the first `<th>`/`<td>` in the custom group). Same treatment in every surface that uses a table.

Today's known custom fields:

- `rsvp_response.notes_json` → `mealChoiceId` (rendered as a "Meal" column resolving the id via `meal_option.label`).
- `guest_response.notes_json` → `dietary`, `songRequest` (rendered as "Dietary" and "Song request" columns; song request shows `title` plus optional `artist`).

These are declared once as constants in `packages/rsvp/src/admin/lib/customFields.ts`:

```ts
export const RSVP_CUSTOM_FIELDS = [
  {
    key: 'mealChoiceId',
    header: 'Meal',
    render: (notesJson, ctx) => ctx.mealLabelById.get(notesJson?.mealChoiceId) ?? null,
  },
] as const

export const GUEST_CUSTOM_FIELDS = [
  { key: 'dietary', header: 'Dietary', render: (j) => j?.dietary ?? null },
  {
    key: 'songRequest',
    header: 'Song request',
    render: (j) =>
      j?.songRequest
        ? j.songRequest.artist
          ? `${j.songRequest.title} — ${j.songRequest.artist}`
          : j.songRequest.title
        : null,
  },
] as const
```

Adding a new custom field in the future = one entry in the appropriate array. The columns and divider follow automatically. Storage already supports it (passthrough keys in `notes_json`).

## Admin "Log" tab

Top nav becomes `Guests | Events | Log`. New route `/admin/log/` rendered by `packages/rsvp/src/admin/log.tsx` (mirrors the `events.tsx` / `import.tsx` entry-file pattern), wrapped in `AdminShell` with `current="log"`. The `AdminShellProps['current']` union grows to `'guests' | 'events' | 'log'`.

Page layout (`packages/rsvp/src/admin/routes/Log.tsx`): two tables stacked, newest-first.

**RSVP responses table.**
- Core columns: Timestamp (`responded_at`), Guest name, Event name, Status (`attending`/`declined`), Responded by (`guest.display_name` of `responded_by_guest_id`).
- Divider.
- Custom columns: every entry from `RSVP_CUSTOM_FIELDS` (today: Meal).

**Guest responses table.**
- Core columns: Timestamp, Guest name, Notes (free-text top-level column), Responded by.
- Divider.
- Custom columns: every entry from `GUEST_CUSTOM_FIELDS` (today: Dietary, Song request).

Server actions in `packages/rsvp/src/server/admin/responses.ts`:

- `listRsvpResponseLog()` — every `rsvp_response` row, joined to guest/event/responder. Includes `notesJson` parsed and a `mealLabelById` lookup payload (or denormalized meal label) so the renderer functions don't need their own queries. Ordered by `responded_at DESC`. Returns a typed `AdminRsvpResponseLogRow[]`.
- `listGuestResponseLog()` — every `guest_response` row, joined to guest/responder. Includes parsed `notesJson`. Ordered by `responded_at DESC`. Returns `AdminGuestResponseLogRow[]`.

The existing `listResponses` (used by the CSV exporter) is kept and rewritten to use `latestRsvpResponses` so the export still represents current state, not the full log.

## Other surfaces showing custom fields

The same custom-field rule (right-aligned, divider, driven by `RSVP_CUSTOM_FIELDS` / `GUEST_CUSTOM_FIELDS`) applies wherever admin renders response data:

- **`GuestDetailModal.tsx` events table** (`packages/rsvp/src/admin/routes/GuestDetailModal.tsx:90-124`) — drop the hard-coded `Meal` column. Core: Event, Status, Responded, By. Divider. Custom: iterated from `RSVP_CUSTOM_FIELDS`. The `getGuest` server action returns `notesJson` per event so renderers can read it.
- **`GuestDetailModal.tsx` profile detail-grid** — the existing free-form display of Dietary and Song-request below the events table is replaced by a single per-guest custom-fields block driven by `GUEST_CUSTOM_FIELDS`. Notes (free-text) and structural fields (group, invite code, email, phone) stay in the core block.
- **`GroupBlock.tsx` per-event status cells** (`packages/rsvp/src/admin/routes/GroupBlock.tsx:69-79`) — drop the inline ` · {mealLabel}` hint. The Guests page is a quick scan view; meal/custom values are visible in the new Log tab and the Guest detail modal. Keeping the per-event grid uncluttered avoids fighting the divider rule on a non-tabular surface.

This keeps a single source of truth for "what custom fields exist and how they render" — the two arrays in `customFields.ts`.

## Routing wiring

One line in the `rscStaticPages` plugin map in `packages/rsvp/vite.config.ts:24-30`:

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

`base: '/admin/'` is set on the Vite config, so `/log/` here resolves to `/admin/log/` at runtime. No `wrangler.toml`, `entry.worker.ts`, or assets-binding changes are needed — the existing static-pages handler dispatches by URL.

## Latent bug fixed in passing

Today's `saveGroup` writes `dietary_restrictions=null, notes=null` on every admin edit because `EditGroupForm` defaults those fields to `''` and never surfaces inputs for them (`EditGroupForm.tsx:27-28`). After a guest RSVPs with dietary "vegan", any subsequent admin edit to that group silently wipes the dietary value. Removing the columns from `guest` and dropping the fields from `adminGuestInputSchema` makes the bug structurally impossible.

## Tests

- `packages/db/src/db.test.ts` — update existing schema-touching tests; add unit tests for `latestRsvpResponses` and `latestGuestResponses` (multiple rows per partition, correct latest selection, empty input handling).
- New tests around `submitRsvp` (in `packages/frontend/`):
  - First submission for a guest/event → one `rsvp_response` row inserted.
  - Re-submitting unchanged values → no new row.
  - Changing status only → new row, prior row untouched.
  - Changing meal only → new row.
  - Changing dietary only → new `guest_response` row, no `rsvp_response` row.
  - Reading after edits → returns latest values.
- `packages/rsvp/src/schema.test.ts` — adjust if it references the dropped admin fields; otherwise unchanged.

## Build sequence

1. Migration + `Database` type + helper functions (`latestRsvpResponses`, `latestGuestResponses`) with their unit tests.
2. Rewrite `submitRsvp` and `getRsvpGroup` against the new tables; update wire-shape glue if any. Tests pass on the public path.
3. Update admin read paths (`listGroups`, `getGroup`, `getGuest`, `listResponses`) to use the latest helpers; trim `saveGroup` and `adminGuestInputSchema`; clean `EditGroupForm` defaults.
4. Add `customFields.ts` and apply the core/custom + divider rule to `GuestDetailModal` (events table and profile block); drop the inline meal hint from `GroupBlock`. `getGuest` returns per-event `notesJson` for the renderers.
5. Add `/admin/log/` route, `Log.tsx` page, `listRsvpResponseLog` / `listGuestResponseLog` server actions, nav entry in `AdminShell`. Tables consume `customFields.ts` so they follow the same rule.
6. Smoke-run `pnpm dev`, walk through: public RSVP → see row in Log; edit → second row in Log; admin save group → no rows added to either log table; CSV export still reflects current state. Visually confirm the divider sits between core and custom columns in the Log tables and the Guest detail modal.

## Failure modes

- **Concurrent submissions.** Two browsers sharing an invite code could insert nearly-simultaneous rows for the same (guest, event). That's fine — both rows are kept; latest by `responded_at` wins. `responded_at` is `nowIso()` so ties are extremely unlikely; if they happen the row order in the table (or a tie-break by `id`) decides.
- **Migration drift.** Editing `0001_init.sql` in place requires wiping local and remote D1. Pre-launch this is acceptable; documenting it in the build sequence.
- **Window-function support.** D1's SQLite supports `ROW_NUMBER()` and other window functions. If a Kysely+kysely-d1 incompatibility surfaces, fall back to a correlated subquery (`WHERE responded_at = (SELECT MAX(responded_at) FROM rsvp_response r2 WHERE r2.guest_id = … AND r2.event_id = …)`) — equivalent results, slightly slower at scale (single-wedding scale doesn't matter).
