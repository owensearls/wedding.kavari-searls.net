# Append-Only RSVP Responses with Configurable Custom Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public RSVP API append-only via two new tables (`rsvp_response`, `guest_response`); generalize the existing meal-options config and the seeded dietary/song-request fields into admin-configurable custom fields with two input types (`short_text`, `single_select`); add an admin "Log" tab listing every row in those tables.

**Architecture:** Single consolidated SQLite/D1 migration (pre-launch wipe). Append-only writes performed by the public worker only; admin is a pure reader of the response tables. Pure-function diff helpers extracted so logic is unit-testable without a DB. Form rendering becomes config-driven (event/guest custom fields supplied by the server). Meal-options UI is generalized into a "Custom fields" editor reused for both per-event and global guest-level configuration.

**Tech Stack:** Cloudflare Workers + D1 (SQLite) + Kysely (`kysely-d1`) + Vite multi-page + RSC RPC. React for both public and admin SPAs. Vitest for unit tests. zod for input validation.

**Spec:** `docs/superpowers/specs/2026-05-03-append-only-rsvp-design.md`

---

## File Structure

### Created files

- `packages/db/src/latest.ts` — `latestRsvpResponses`, `latestGuestResponses`, `loadEventCustomFields`, `loadGuestCustomFields` helpers.
- `packages/db/src/diff.ts` — pure-function diff helpers (`diffRsvpResponse`, `diffGuestResponse`, `validateNotesJson`, `canonicalNotesJson`).
- `packages/db/src/diff.test.ts` — unit tests for the diff helpers.
- `packages/rsvp/src/server/admin/customFields.ts` — server actions for guest-scoped and event-scoped custom-field config.
- `packages/rsvp/src/admin/routes/CustomFieldsEditor.tsx` — shared add/edit/reorder/delete UI for a list of custom fields, used by both the Events page (global guest fields) and the event edit form (per-event fields).
- `packages/rsvp/src/admin/routes/CustomFieldsEditor.module.css` — styles for the editor.
- `packages/rsvp/src/admin/routes/Log.tsx` — Log page (RSVP responses + Guest responses tables).
- `packages/rsvp/src/admin/routes/Log.module.css` — styles for the Log page.
- `packages/rsvp/src/admin/log.tsx` — entry that wraps `Log` in `AdminShell`.
- `packages/rsvp/src/admin/lib/customFieldRender.ts` — pure helpers for rendering a `notes_json` value against a `CustomFieldConfig` (`renderCustomFieldValue`, `buildOptionLabelMap`).

### Modified files

- `packages/db/migrations/0001_init.sql` — schema rewrite.
- `packages/db/src/schema.ts` — `Database` type rewrite.
- `packages/db/src/db.ts` — re-export new helpers.
- `packages/db/src/index.ts` — re-exports.
- `packages/db/src/db.test.ts` — unchanged (existing pure-fn tests).
- `packages/frontend/src/schema.ts` — drop legacy `RsvpRecord.mealChoiceId` / `Guest.dietaryRestrictions` / nested `notesJson.songRequest`; add `CustomFieldConfig`, `customFields` on `EventDetails`, `guestCustomFields` on `RsvpGroupResponse`, `notesJson: Record<string, string|null>` on `RsvpRecord` and `Guest`.
- `packages/frontend/src/server/rsvp.ts` — rewrite `getRsvpGroup` and `submitRsvp`.
- `packages/frontend/src/rsvp/RsvpFull.tsx` — config-driven inputs.
- `packages/frontend/src/rsvp/EventCardEditor.tsx` — render `event.customFields` instead of meal options.
- `packages/frontend/src/rsvp/rsvpFormState.ts` — generalized form state.
- `packages/rsvp/src/schema.ts` — drop dietary/notes from admin guest input; drop meal-options/requiresMealChoice from admin event input; add `adminCustomFieldInputSchema` and friends; replace `mealLabel` on `AdminGuestEventStatus` with `notesJson`.
- `packages/rsvp/src/schema.test.ts` — adjust for renamed/dropped fields.
- `packages/rsvp/src/server/admin/events.ts` — drop meal_option / requires_meal_choice writes.
- `packages/rsvp/src/server/admin/groups.ts` — drop dietary/notes writes; reads pull from latest `guest_response`.
- `packages/rsvp/src/server/admin/guests.ts` — reads pull from latest `guest_response` and resolve event customs from configs.
- `packages/rsvp/src/server/admin/responses.ts` — `listResponses` rewritten over latest helpers; new `listRsvpResponseLog` and `listGuestResponseLog`.
- `packages/rsvp/src/admin/AdminShell.tsx` — add "Log" nav entry; widen `current` union.
- `packages/rsvp/src/admin/routes/EditEventForm.tsx` — replace meal-options block with `CustomFieldsEditor`; remove `requiresMealChoice` checkbox.
- `packages/rsvp/src/admin/routes/EditGroupForm.tsx` — drop dietary/notes from `blankGuest`.
- `packages/rsvp/src/admin/routes/EventSettings.tsx` — add a "Guest profile fields" section above the events list that uses `CustomFieldsEditor`.
- `packages/rsvp/src/admin/routes/GuestList.tsx` — pull `guestCustomFields` from server; pass to `GroupBlock`.
- `packages/rsvp/src/admin/routes/GroupBlock.tsx` — drop inline meal hint; render core "Notes" cell + divider + per-guest-custom columns.
- `packages/rsvp/src/admin/routes/GuestDetailModal.tsx` — restructure header (core + divider + custom rows); events table with divider + dynamic "Custom answers" cell; drop trailing song-request section.
- `packages/rsvp/src/admin/routes/GuestList.module.css` — small additions for `customDivider` class.
- `packages/rsvp/src/admin/lib/rsvpCsv.ts` — adjust for the new shape (custom answers as a single serialized cell).
- `packages/rsvp/vite.config.ts` — add `/log/` entry.

---

## Conventions

- All TypeScript code uses 2-space indent, no semicolons-required (project uses Prettier defaults already in repo).
- IDs use the `newId('<prefix>')` helper. New prefixes introduced: `rresp` (rsvp_response), `gresp` (guest_response), `ecf` (event_custom_field), `ecfo` (event_custom_field_option), `gcf` (guest_custom_field), `gcfo` (guest_custom_field_option).
- After every passing step, run from repo root:
  - `pnpm typecheck` — must pass.
  - `pnpm vitest run` — all tests must pass.
- Commits use the project's existing short-imperative style (see `git log`); no Co-Authored-By trailer (per repo memory).
- Tests live next to source as `*.test.ts` under `src/`.
- "Run from repo root" applies unless otherwise noted.

---

## Phase 1 — DB schema, types, and pure helpers

### Task 1: Rewrite the migration

**Files:**
- Modify: `packages/db/migrations/0001_init.sql`

- [ ] **Step 1: Replace the file contents**

Replace the file with:

```sql
-- Initial schema (consolidated). Pre-launch single migration.

-- ── Guests ──────────────────────────────────────────────────────────────
CREATE TABLE guest (
  id TEXT PRIMARY KEY,
  party_leader_id TEXT REFERENCES guest(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invite_code TEXT UNIQUE,
  group_label TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_guest_party_leader ON guest(party_leader_id);
CREATE INDEX idx_guest_invite_code ON guest(invite_code);
CREATE INDEX idx_guest_email ON guest(email);
CREATE INDEX idx_guest_display_name ON guest(display_name);

-- ── Events ──────────────────────────────────────────────────────────────
CREATE TABLE event (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  starts_at TEXT,
  ends_at TEXT,
  location_name TEXT,
  address TEXT,
  rsvp_deadline TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Invitations ─────────────────────────────────────────────────────────
CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  UNIQUE (guest_id, event_id)
);
CREATE INDEX idx_invitation_guest ON invitation(guest_id);
CREATE INDEX idx_invitation_event ON invitation(event_id);

-- ── Custom field configuration ──────────────────────────────────────────
CREATE TABLE event_custom_field (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('short_text', 'single_select')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, key)
);
CREATE INDEX idx_event_custom_field_event
  ON event_custom_field(event_id, sort_order);

CREATE TABLE event_custom_field_option (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES event_custom_field(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_event_custom_field_option_field
  ON event_custom_field_option(field_id, sort_order);

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

-- ── Append-only response tables ─────────────────────────────────────────
CREATE TABLE rsvp_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'declined')),
  notes_json TEXT,
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_rsvp_response_guest_event_at
  ON rsvp_response(guest_id, event_id, responded_at);

CREATE TABLE guest_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  notes TEXT,
  notes_json TEXT,
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_guest_response_guest_at
  ON guest_response(guest_id, responded_at);

-- ── Seeds ────────────────────────────────────────────────────────────────
INSERT INTO guest_custom_field (id, key, label, type, sort_order) VALUES
  ('gcf_dietary',      'dietary_restrictions', 'Dietary restrictions or allergies', 'short_text', 0),
  ('gcf_song_request', 'song_request',         'Song request',                       'short_text', 1);
```

- [ ] **Step 2: Wipe and re-apply local D1**

Run from repo root:

```bash
pnpm clean && pnpm --filter rsvp db:migrate:local
```

Expected: migration applies cleanly with no SQL errors. (`pnpm clean` removes `.wrangler/state`.)

- [ ] **Step 3: Commit**

```bash
git add packages/db/migrations/0001_init.sql
git commit -m "Rewrite 0001_init for append-only responses + custom fields"
```

---

### Task 2: Update the `Database` type to match

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Replace the file contents**

```ts
export interface GuestTable {
  id: string
  party_leader_id: string | null
  first_name: string
  last_name: string | null
  display_name: string
  email: string | null
  phone: string | null
  invite_code: string
  group_label: string | null
  created_at: string
  updated_at: string
}

export interface EventTable {
  id: string
  name: string
  slug: string
  starts_at: string | null
  ends_at: string | null
  location_name: string | null
  address: string | null
  rsvp_deadline: string | null
  sort_order: number
}

export interface InvitationTable {
  id: string
  guest_id: string
  event_id: string
}

export interface EventCustomFieldTable {
  id: string
  event_id: string
  key: string
  label: string
  type: 'short_text' | 'single_select'
  sort_order: number
}

export interface EventCustomFieldOptionTable {
  id: string
  field_id: string
  label: string
  description: string | null
  sort_order: number
}

export interface GuestCustomFieldTable {
  id: string
  key: string
  label: string
  type: 'short_text' | 'single_select'
  sort_order: number
}

export interface GuestCustomFieldOptionTable {
  id: string
  field_id: string
  label: string
  description: string | null
  sort_order: number
}

export interface RsvpResponseTable {
  id: string
  guest_id: string
  event_id: string
  status: 'attending' | 'declined'
  notes_json: string | null
  responded_at: string
  responded_by_guest_id: string | null
}

export interface GuestResponseTable {
  id: string
  guest_id: string
  notes: string | null
  notes_json: string | null
  responded_at: string
  responded_by_guest_id: string | null
}

export interface Database {
  guest: GuestTable
  event: EventTable
  invitation: InvitationTable
  event_custom_field: EventCustomFieldTable
  event_custom_field_option: EventCustomFieldOptionTable
  guest_custom_field: GuestCustomFieldTable
  guest_custom_field_option: GuestCustomFieldOptionTable
  rsvp_response: RsvpResponseTable
  guest_response: GuestResponseTable
}
```

- [ ] **Step 2: Run typecheck**

`pnpm typecheck` — expect failures in many callers (we'll fix them in subsequent tasks). The DB-package typecheck itself should pass.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "Update Database type for new schema"
```

---

### Task 3: Pure helpers — `canonicalNotesJson` and `validateNotesJson`

**Files:**
- Create: `packages/db/src/diff.ts`
- Create: `packages/db/src/diff.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/db/src/diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  canonicalNotesJson,
  validateNotesJson,
  type CustomFieldConfig,
} from './diff'

const shortText: CustomFieldConfig = {
  id: 'f1',
  key: 'dietary_restrictions',
  label: 'Dietary',
  type: 'short_text',
  sortOrder: 0,
  options: [],
}

const select: CustomFieldConfig = {
  id: 'f2',
  key: 'meal_choice',
  label: 'Meal',
  type: 'single_select',
  sortOrder: 0,
  options: [
    { id: 'opt_a', label: 'Chicken', description: null },
    { id: 'opt_b', label: 'Fish', description: null },
  ],
}

describe('canonicalNotesJson', () => {
  it('sorts keys deterministically and stringifies', () => {
    expect(canonicalNotesJson({ b: '2', a: '1' })).toBe('{"a":"1","b":"2"}')
  })

  it('returns null for empty objects', () => {
    expect(canonicalNotesJson({})).toBeNull()
    expect(canonicalNotesJson(null)).toBeNull()
  })

  it('drops null-valued keys', () => {
    expect(canonicalNotesJson({ a: '1', b: null })).toBe('{"a":"1"}')
  })
})

describe('validateNotesJson', () => {
  it('accepts valid short_text', () => {
    expect(
      validateNotesJson({ dietary_restrictions: 'vegan' }, [shortText])
    ).toEqual({ ok: true, value: { dietary_restrictions: 'vegan' } })
  })

  it('trims and empties short_text', () => {
    expect(
      validateNotesJson({ dietary_restrictions: '   ' }, [shortText])
    ).toEqual({ ok: true, value: { dietary_restrictions: null } })
  })

  it('rejects unknown keys', () => {
    const r = validateNotesJson({ surprise: 'x' }, [shortText])
    expect(r.ok).toBe(false)
  })

  it('rejects single_select values not in options', () => {
    const r = validateNotesJson({ meal_choice: 'opt_z' }, [select])
    expect(r.ok).toBe(false)
  })

  it('accepts known single_select option ids', () => {
    expect(validateNotesJson({ meal_choice: 'opt_a' }, [select])).toEqual({
      ok: true,
      value: { meal_choice: 'opt_a' },
    })
  })

  it('accepts null for any field', () => {
    expect(validateNotesJson({ meal_choice: null }, [select])).toEqual({
      ok: true,
      value: { meal_choice: null },
    })
  })

  it('rejects short_text longer than 500 chars', () => {
    const r = validateNotesJson(
      { dietary_restrictions: 'x'.repeat(501) },
      [shortText]
    )
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run packages/db/src/diff.test.ts
```

Expected: FAIL with import error (`./diff` doesn't exist).

- [ ] **Step 3: Implement**

Create `packages/db/src/diff.ts`:

```ts
export interface CustomFieldOption {
  id: string
  label: string
  description: string | null
}

export interface CustomFieldConfig {
  id: string
  key: string
  label: string
  type: 'short_text' | 'single_select'
  sortOrder: number
  options: CustomFieldOption[]
}

export type NotesJsonValue = string | null
export type NotesJson = Record<string, NotesJsonValue>

export type ValidationResult =
  | { ok: true; value: NotesJson }
  | { ok: false; error: string }

const SHORT_TEXT_MAX = 500

/**
 * Validate a notes_json blob against a list of field configs.
 * Returns a sanitized clone (trimmed strings, empty → null).
 */
export function validateNotesJson(
  input: NotesJson | null | undefined,
  fields: CustomFieldConfig[]
): ValidationResult {
  if (!input) return { ok: true, value: {} }
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const out: NotesJson = {}
  for (const [key, raw] of Object.entries(input)) {
    const field = byKey.get(key)
    if (!field) return { ok: false, error: `Unknown field: ${key}` }
    if (raw === null || raw === undefined) {
      out[key] = null
      continue
    }
    if (typeof raw !== 'string') {
      return { ok: false, error: `Field ${key} must be a string or null` }
    }
    if (field.type === 'short_text') {
      const trimmed = raw.trim()
      if (trimmed.length > SHORT_TEXT_MAX) {
        return { ok: false, error: `Field ${key} exceeds ${SHORT_TEXT_MAX} chars` }
      }
      out[key] = trimmed === '' ? null : trimmed
    } else {
      // single_select
      const validIds = new Set(field.options.map((o) => o.id))
      if (raw === '') {
        out[key] = null
      } else if (!validIds.has(raw)) {
        return { ok: false, error: `Field ${key} value not in options` }
      } else {
        out[key] = raw
      }
    }
  }
  return { ok: true, value: out }
}

/**
 * Produce a deterministic JSON representation for diffing.
 * Drops null-valued keys; sorts keys; returns null for empty.
 */
export function canonicalNotesJson(input: NotesJson | null): string | null {
  if (!input) return null
  const entries = Object.entries(input).filter(([, v]) => v !== null)
  if (entries.length === 0) return null
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return JSON.stringify(Object.fromEntries(entries))
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run packages/db/src/diff.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/diff.ts packages/db/src/diff.test.ts
git commit -m "Add notes_json diff helpers (canonical + validation)"
```

---

### Task 4: Pure helpers — `diffRsvpResponse` and `diffGuestResponse`

**Files:**
- Modify: `packages/db/src/diff.ts`
- Modify: `packages/db/src/diff.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `packages/db/src/diff.test.ts`:

```ts
import { diffRsvpResponse, diffGuestResponse } from './diff'

describe('diffRsvpResponse', () => {
  it('returns insert when no latest row exists', () => {
    const r = diffRsvpResponse({
      latest: null,
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_a' } },
    })
    expect(r).toEqual({ insert: true, notesJson: '{"meal_choice":"opt_a"}' })
  })

  it('skips insert when status and notes_json are unchanged', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: '{"meal_choice":"opt_a"}' },
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_a' } },
    })
    expect(r).toEqual({ insert: false })
  })

  it('inserts when status changes', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: null },
      submitted: { status: 'declined', notesJson: {} },
    })
    expect(r.insert).toBe(true)
  })

  it('inserts when notes_json changes', () => {
    const r = diffRsvpResponse({
      latest: { status: 'attending', notesJson: '{"meal_choice":"opt_a"}' },
      submitted: { status: 'attending', notesJson: { meal_choice: 'opt_b' } },
    })
    expect(r.insert).toBe(true)
  })
})

describe('diffGuestResponse', () => {
  it('returns insert when no latest row exists', () => {
    const r = diffGuestResponse({
      latest: null,
      submitted: { notes: 'hi', notesJson: { dietary_restrictions: 'vegan' } },
    })
    expect(r.insert).toBe(true)
  })

  it('skips insert when notes and notes_json are unchanged', () => {
    const r = diffGuestResponse({
      latest: { notes: 'hi', notesJson: '{"dietary_restrictions":"vegan"}' },
      submitted: { notes: 'hi', notesJson: { dietary_restrictions: 'vegan' } },
    })
    expect(r.insert).toBe(false)
  })

  it('treats null and "" notes as equal', () => {
    const r = diffGuestResponse({
      latest: { notes: null, notesJson: null },
      submitted: { notes: '', notesJson: {} },
    })
    expect(r.insert).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failures**

```bash
pnpm vitest run packages/db/src/diff.test.ts
```

Expected: imports fail.

- [ ] **Step 3: Implement**

Append to `packages/db/src/diff.ts`:

```ts
export interface RsvpDiffInput {
  latest: { status: 'attending' | 'declined'; notesJson: string | null } | null
  submitted: {
    status: 'attending' | 'declined'
    notesJson: NotesJson
  }
}

export type RsvpDiffResult =
  | { insert: false }
  | { insert: true; notesJson: string | null }

export function diffRsvpResponse(input: RsvpDiffInput): RsvpDiffResult {
  const nextCanonical = canonicalNotesJson(input.submitted.notesJson)
  if (input.latest === null) {
    return { insert: true, notesJson: nextCanonical }
  }
  if (
    input.latest.status === input.submitted.status &&
    (input.latest.notesJson ?? null) === nextCanonical
  ) {
    return { insert: false }
  }
  return { insert: true, notesJson: nextCanonical }
}

export interface GuestDiffInput {
  latest: { notes: string | null; notesJson: string | null } | null
  submitted: { notes: string | null; notesJson: NotesJson }
}

export type GuestDiffResult =
  | { insert: false }
  | { insert: true; notes: string | null; notesJson: string | null }

export function diffGuestResponse(input: GuestDiffInput): GuestDiffResult {
  const nextNotes = normaliseNotes(input.submitted.notes)
  const nextCanonical = canonicalNotesJson(input.submitted.notesJson)
  if (input.latest === null) {
    if (nextNotes === null && nextCanonical === null) return { insert: false }
    return { insert: true, notes: nextNotes, notesJson: nextCanonical }
  }
  if (
    (input.latest.notes ?? null) === nextNotes &&
    (input.latest.notesJson ?? null) === nextCanonical
  ) {
    return { insert: false }
  }
  return { insert: true, notes: nextNotes, notesJson: nextCanonical }
}

function normaliseNotes(s: string | null): string | null {
  if (s === null) return null
  const trimmed = s.trim()
  return trimmed === '' ? null : trimmed
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run packages/db/src/diff.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/diff.ts packages/db/src/diff.test.ts
git commit -m "Add diffRsvpResponse and diffGuestResponse helpers"
```

---

### Task 5: DB helpers — `latestRsvpResponses` / `latestGuestResponses` / config loaders

**Files:**
- Create: `packages/db/src/latest.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Implement helpers**

Create `packages/db/src/latest.ts`. Latest-per-partition is computed in app code (small dataset, avoids kysely-CTE typing complexity):

```ts
import type { Db } from './db'
import type { CustomFieldConfig } from './diff'

export interface LatestRsvpResponseRow {
  id: string
  guestId: string
  eventId: string
  status: 'attending' | 'declined'
  notesJson: string | null
  respondedAt: string
  respondedByGuestId: string | null
}

export async function latestRsvpResponses(
  db: Db,
  filter?: { guestIds?: string[]; eventIds?: string[] }
): Promise<LatestRsvpResponseRow[]> {
  let q = db.selectFrom('rsvp_response').selectAll()
  if (filter?.guestIds && filter.guestIds.length > 0) {
    q = q.where('guest_id', 'in', filter.guestIds)
  }
  if (filter?.eventIds && filter.eventIds.length > 0) {
    q = q.where('event_id', 'in', filter.eventIds)
  }
  const rows = await q.execute()
  type R = (typeof rows)[number]
  const byKey = new Map<string, R>()
  for (const r of rows) {
    const k = `${r.guest_id}::${r.event_id}`
    const prev = byKey.get(k)
    if (
      !prev ||
      r.responded_at > prev.responded_at ||
      (r.responded_at === prev.responded_at && r.id > prev.id)
    ) {
      byKey.set(k, r)
    }
  }
  return [...byKey.values()].map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    eventId: r.event_id,
    status: r.status,
    notesJson: r.notes_json,
    respondedAt: r.responded_at,
    respondedByGuestId: r.responded_by_guest_id,
  }))
}

export interface LatestGuestResponseRow {
  id: string
  guestId: string
  notes: string | null
  notesJson: string | null
  respondedAt: string
  respondedByGuestId: string | null
}

export async function latestGuestResponses(
  db: Db,
  filter?: { guestIds?: string[] }
): Promise<LatestGuestResponseRow[]> {
  let q = db.selectFrom('guest_response').selectAll()
  if (filter?.guestIds && filter.guestIds.length > 0) {
    q = q.where('guest_id', 'in', filter.guestIds)
  }
  const rows = await q.execute()
  type R = (typeof rows)[number]
  const byKey = new Map<string, R>()
  for (const r of rows) {
    const prev = byKey.get(r.guest_id)
    if (
      !prev ||
      r.responded_at > prev.responded_at ||
      (r.responded_at === prev.responded_at && r.id > prev.id)
    ) {
      byKey.set(r.guest_id, r)
    }
  }
  return [...byKey.values()].map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    notes: r.notes,
    notesJson: r.notes_json,
    respondedAt: r.responded_at,
    respondedByGuestId: r.responded_by_guest_id,
  }))
}

export async function loadEventCustomFields(
  db: Db,
  eventIds: string[]
): Promise<Map<string, CustomFieldConfig[]>> {
  const out = new Map<string, CustomFieldConfig[]>()
  if (eventIds.length === 0) return out
  const fields = await db
    .selectFrom('event_custom_field')
    .selectAll()
    .where('event_id', 'in', eventIds)
    .orderBy(['event_id', 'sort_order'])
    .execute()
  if (fields.length === 0) return out
  const fieldIds = fields.map((f) => f.id)
  const options = await db
    .selectFrom('event_custom_field_option')
    .selectAll()
    .where('field_id', 'in', fieldIds)
    .orderBy(['field_id', 'sort_order'])
    .execute()
  const optionsByField = new Map<string, CustomFieldConfig['options']>()
  for (const o of options) {
    const arr = optionsByField.get(o.field_id) ?? []
    arr.push({ id: o.id, label: o.label, description: o.description })
    optionsByField.set(o.field_id, arr)
  }
  for (const f of fields) {
    const arr = out.get(f.event_id) ?? []
    arr.push({
      id: f.id,
      key: f.key,
      label: f.label,
      type: f.type,
      sortOrder: f.sort_order,
      options: optionsByField.get(f.id) ?? [],
    })
    out.set(f.event_id, arr)
  }
  return out
}

export async function loadGuestCustomFields(
  db: Db
): Promise<CustomFieldConfig[]> {
  const fields = await db
    .selectFrom('guest_custom_field')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  if (fields.length === 0) return []
  const fieldIds = fields.map((f) => f.id)
  const options = await db
    .selectFrom('guest_custom_field_option')
    .selectAll()
    .where('field_id', 'in', fieldIds)
    .orderBy(['field_id', 'sort_order'])
    .execute()
  const optionsByField = new Map<string, CustomFieldConfig['options']>()
  for (const o of options) {
    const arr = optionsByField.get(o.field_id) ?? []
    arr.push({ id: o.id, label: o.label, description: o.description })
    optionsByField.set(o.field_id, arr)
  }
  return fields.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    sortOrder: f.sort_order,
    options: optionsByField.get(f.id) ?? [],
  }))
}
```

- [ ] **Step 2: Re-export from package**

Modify `packages/db/src/index.ts`:

```ts
export { getDb, newId, newInviteCode, nowIso, type Db } from './db'
export {
  aggregateLookupMatches,
  normalize,
  score,
  tokens,
  type AggregatedLookupMatch,
  type LookupCandidate,
} from './fuzzy'
export {
  canonicalNotesJson,
  diffGuestResponse,
  diffRsvpResponse,
  validateNotesJson,
  type CustomFieldConfig,
  type CustomFieldOption,
  type GuestDiffInput,
  type GuestDiffResult,
  type NotesJson,
  type NotesJsonValue,
  type RsvpDiffInput,
  type RsvpDiffResult,
} from './diff'
export {
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  type LatestGuestResponseRow,
  type LatestRsvpResponseRow,
} from './latest'
```

- [ ] **Step 3: Build the db package**

```bash
pnpm --filter db build
```

Expected: builds cleanly. (No DB tests for these helpers in this task — they're verified end-to-end via the smoke run in the final phase.)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/latest.ts packages/db/src/index.ts
git commit -m "Add latest-response and custom-field config db helpers"
```

---

## Phase 2 — Public path (frontend worker)

### Task 6: Update frontend wire schema

**Files:**
- Modify: `packages/frontend/src/schema.ts`

- [ ] **Step 1: Replace the file contents**

```ts
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
```

- [ ] **Step 2: Typecheck the frontend package**

```bash
pnpm --filter frontend typecheck
```

Expected: failures in `rsvp.ts` and form components — fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/schema.ts
git commit -m "Generalize public wire shape for custom fields"
```

---

### Task 7: Rewrite `getRsvpGroup`

**Files:**
- Modify: `packages/frontend/src/server/rsvp.ts`

- [ ] **Step 1: Replace the body of `getRsvpGroup`**

Open `packages/frontend/src/server/rsvp.ts` and replace the existing function with:

```ts
export async function getRsvpGroup(code: string): Promise<RsvpGroupResponse> {
  if (!code) throw new RscActionError(400, 'Missing invite code')
  const db = getDbConn()

  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) throw new RscActionError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', leaderId)
    .executeTakeFirst()
  if (!leader) throw new RscActionError(404, 'Party leader not found')

  const members = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', '=', leaderId)
    .execute()
  const allGuests = [leader, ...members]
  const guestIds = allGuests.map((g) => g.id)

  const invitations = await db
    .selectFrom('invitation')
    .selectAll()
    .where('guest_id', '=', leaderId)
    .execute()
  const eventIds = invitations.map((i) => i.event_id)

  const events = eventIds.length
    ? await db
        .selectFrom('event')
        .selectAll()
        .where('id', 'in', eventIds)
        .orderBy('sort_order')
        .execute()
    : []

  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)
  const latestRsvps = await latestRsvpResponses(db, { guestIds, eventIds })
  const latestGuests = await latestGuestResponses(db, { guestIds })

  const eventsResponse: EventDetails[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    locationName: e.location_name,
    address: e.address,
    rsvpDeadline: e.rsvp_deadline,
    sortOrder: e.sort_order,
    invitedGuestIds: guestIds,
    customFields: eventCustomFieldsByEvent.get(e.id) ?? [],
  }))

  const guestById = new Map(allGuests.map((g) => [g.id, g]))
  const latestGuestByGuestId = new Map(latestGuests.map((r) => [r.guestId, r]))

  const guestsResponse: Guest[] = allGuests.map((g) => {
    const lr = latestGuestByGuestId.get(g.id)
    return {
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      displayName: g.display_name,
      email: g.email,
      phone: g.phone,
      inviteCode: g.invite_code,
      notes: lr?.notes ?? null,
      notesJson: parseNotesJson(lr?.notesJson ?? null),
    }
  })

  const rsvps: RsvpRecord[] = latestRsvps.map((r) => ({
    guestId: r.guestId,
    eventId: r.eventId,
    status: r.status,
    notesJson: parseNotesJson(r.notesJson),
    respondedAt: r.respondedAt,
  }))

  return {
    group: { id: leaderId, label: leader.group_label ?? '' },
    actingGuestId: actingGuest.id,
    guests: guestsResponse,
    events: eventsResponse,
    rsvps,
    guestCustomFields,
  }
}

function parseNotesJson(raw: string | null): NotesJson {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
```

- [ ] **Step 2: Update imports at the top of the file**

Replace the import block with:

```ts
'use server'

import {
  aggregateLookupMatches,
  canonicalNotesJson,
  diffGuestResponse,
  diffRsvpResponse,
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  newId,
  nowIso,
  validateNotesJson,
} from 'db'
import { getEnv } from 'db/context'
import { RscActionError } from 'rsc-utils/functions/server'
import {
  lookupQuerySchema,
  rsvpSubmissionSchema,
  type EventDetails,
  type Guest,
  type LookupResponse,
  type NotesJson,
  type RsvpGroupResponse,
  type RsvpRecord,
  type RsvpSubmission,
} from '../schema'
```

- [ ] **Step 3: Build to surface remaining errors**

```bash
pnpm --filter frontend typecheck
```

Expected: `submitRsvp` still references the old shape; we'll replace it next.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/server/rsvp.ts
git commit -m "Rewrite getRsvpGroup over latest helpers + custom-field configs"
```

---

### Task 8: Rewrite `submitRsvp` with append-only diffing

**Files:**
- Modify: `packages/frontend/src/server/rsvp.ts`

- [ ] **Step 1: Replace `submitRsvp`**

Replace the function body with:

```ts
export async function submitRsvp(
  code: string,
  submission: RsvpSubmission
): Promise<{ ok: true; respondedAt: string }> {
  if (!code) throw new RscActionError(400, 'Missing invite code')

  const parsed = rsvpSubmissionSchema.safeParse(submission)
  if (!parsed.success) throw new RscActionError(400, 'Invalid submission data')
  const data = parsed.data

  const db = getDbConn()

  const actingGuest = await db
    .selectFrom('guest')
    .select(['id', 'party_leader_id'])
    .where('invite_code', '=', code)
    .executeTakeFirst()
  if (!actingGuest) throw new RscActionError(404, 'Invite code not found')

  const leaderId = actingGuest.party_leader_id ?? actingGuest.id

  const partyGuests = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([eb('id', '=', leaderId), eb('party_leader_id', '=', leaderId)])
    )
    .execute()
  const allowedGuestIds = new Set(partyGuests.map((g) => g.id))

  if (!allowedGuestIds.has(data.respondedByGuestId)) {
    throw new RscActionError(400, 'respondedByGuestId is not in this group')
  }

  const invitations = await db
    .selectFrom('invitation')
    .select(['event_id'])
    .where('guest_id', '=', leaderId)
    .execute()
  const invitedEventIds = new Set(invitations.map((i) => i.event_id))

  const eventIds = [...invitedEventIds]
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)

  // Validate per-event submissions.
  for (const r of data.rsvps) {
    if (!allowedGuestIds.has(r.guestId)) {
      throw new RscActionError(400, `Guest ${r.guestId} is not in this group`)
    }
    if (!invitedEventIds.has(r.eventId)) {
      throw new RscActionError(
        400,
        `Group is not invited to event ${r.eventId}`
      )
    }
    if (r.status === 'attending' || r.status === 'declined') {
      const config = eventCustomFieldsByEvent.get(r.eventId) ?? []
      const v = validateNotesJson(r.notesJson, config)
      if (!v.ok) throw new RscActionError(400, v.error)
    }
  }

  // Validate per-guest submissions.
  for (const u of data.guestUpdates) {
    if (!allowedGuestIds.has(u.guestId)) continue
    const v = validateNotesJson(u.notesJson, guestCustomFields)
    if (!v.ok) throw new RscActionError(400, v.error)
  }

  const guestIdsTouched = Array.from(
    new Set([
      ...data.rsvps.map((r) => r.guestId),
      ...data.guestUpdates.map((u) => u.guestId),
    ])
  )

  const latestRsvps = await latestRsvpResponses(db, {
    guestIds: guestIdsTouched,
    eventIds: data.rsvps.map((r) => r.eventId),
  })
  const latestRsvpKey = (g: string, e: string) => `${g}::${e}`
  const latestRsvpMap = new Map(
    latestRsvps.map((r) => [latestRsvpKey(r.guestId, r.eventId), r])
  )

  const latestGuests = await latestGuestResponses(db, {
    guestIds: guestIdsTouched,
  })
  const latestGuestMap = new Map(latestGuests.map((r) => [r.guestId, r]))

  const now = nowIso()

  for (const r of data.rsvps) {
    if (r.status === 'pending') continue
    const config = eventCustomFieldsByEvent.get(r.eventId) ?? []
    const sanitized = validateNotesJson(r.notesJson, config)
    if (!sanitized.ok) continue // already rejected above; defensive
    const latest = latestRsvpMap.get(latestRsvpKey(r.guestId, r.eventId))
    const diff = diffRsvpResponse({
      latest: latest
        ? { status: latest.status, notesJson: latest.notesJson }
        : null,
      submitted: { status: r.status, notesJson: sanitized.value },
    })
    if (!diff.insert) continue
    await db
      .insertInto('rsvp_response')
      .values({
        id: newId('rresp'),
        guest_id: r.guestId,
        event_id: r.eventId,
        status: r.status,
        notes_json: diff.notesJson,
        responded_at: now,
        responded_by_guest_id: data.respondedByGuestId,
      })
      .execute()
  }

  for (const u of data.guestUpdates) {
    if (!allowedGuestIds.has(u.guestId)) continue
    const sanitized = validateNotesJson(u.notesJson, guestCustomFields)
    if (!sanitized.ok) continue
    const latest = latestGuestMap.get(u.guestId)
    const submittedNotes =
      typeof u.notes === 'string' ? u.notes : (u.notes ?? null)
    const diff = diffGuestResponse({
      latest: latest
        ? { notes: latest.notes, notesJson: latest.notesJson }
        : null,
      submitted: { notes: submittedNotes, notesJson: sanitized.value },
    })
    if (!diff.insert) continue
    await db
      .insertInto('guest_response')
      .values({
        id: newId('gresp'),
        guest_id: u.guestId,
        notes: diff.notes,
        notes_json: diff.notesJson,
        responded_at: now,
        responded_by_guest_id: data.respondedByGuestId,
      })
      .execute()
  }

  return { ok: true, respondedAt: now }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter frontend typecheck
```

Expected: PASS for `rsvp.ts`. Form components (`RsvpFull.tsx`, `EventCardEditor.tsx`, `rsvpFormState.ts`) still fail — fixed next.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/server/rsvp.ts
git commit -m "Rewrite submitRsvp as append-only with diff helpers"
```

---

### Task 9: Update `rsvpFormState`

**Files:**
- Modify: `packages/frontend/src/rsvp/rsvpFormState.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import type {
  CustomFieldConfig,
  NotesJson,
  RsvpGroupResponse,
  RsvpStatus,
} from '../schema'

export type RsvpKey = `${string}::${string}`

export interface RsvpFormState {
  rsvps: Record<
    RsvpKey,
    { status: RsvpStatus | 'pending'; notesJson: NotesJson }
  >
  guestNotesJson: Record<string, NotesJson>
  guestNotes: Record<string, string>
  respondedByGuestId: string
}

export function rsvpKey(guestId: string, eventId: string): RsvpKey {
  return `${guestId}::${eventId}` as RsvpKey
}

export function formatRsvpDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

export function buildInitialRsvpFormState(
  data: RsvpGroupResponse
): RsvpFormState {
  const rsvps: RsvpFormState['rsvps'] = {}
  for (const ev of data.events) {
    for (const guestId of ev.invitedGuestIds) {
      const existing = data.rsvps.find(
        (r) => r.guestId === guestId && r.eventId === ev.id
      )
      rsvps[rsvpKey(guestId, ev.id)] = {
        status: existing?.status ?? 'pending',
        notesJson: existing?.notesJson ?? {},
      }
    }
  }
  const guestNotesJson: Record<string, NotesJson> = {}
  const guestNotes: Record<string, string> = {}
  for (const g of data.guests) {
    guestNotesJson[g.id] = g.notesJson ?? {}
    guestNotes[g.id] = g.notes ?? ''
  }
  return {
    rsvps,
    guestNotesJson,
    guestNotes,
    respondedByGuestId: data.actingGuestId || data.guests[0]?.id || '',
  }
}

export function defaultValueForField(
  field: CustomFieldConfig,
  current: NotesJson
): string {
  const v = current[field.key]
  return typeof v === 'string' ? v : ''
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter frontend typecheck
```

Expected: failures move to RsvpFull/EventCardEditor.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/rsvp/rsvpFormState.ts
git commit -m "Generalize RsvpFormState for config-driven inputs"
```

---

### Task 10: Update `EventCardEditor` to render custom fields

**Files:**
- Modify: `packages/frontend/src/rsvp/EventCardEditor.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { defaultValueForField, rsvpKey, formatRsvpDate, type RsvpFormState } from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type { EventDetails, Guest, NotesJson, RsvpStatus } from '../schema'

interface EventCardEditorProps {
  event: EventDetails
  guestById: Map<string, Guest>
  state: RsvpFormState
  singleGuest: boolean
  onStatusChange: (guestId: string, eventId: string, status: RsvpStatus) => void
  onCustomChange: (
    guestId: string,
    eventId: string,
    fieldKey: string,
    value: string
  ) => void
}

export function EventCardEditor({
  event,
  guestById,
  state,
  singleGuest,
  onStatusChange,
  onCustomChange,
}: EventCardEditorProps) {
  const dateText = formatRsvpDate(event.startsAt)

  function renderToggleAndCustom(guestId: string) {
    const k = rsvpKey(guestId, event.id)
    const current = state.rsvps[k] ?? { status: 'pending', notesJson: {} }
    return (
      <>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggleButton} ${current.status === 'attending' ? styles.toggleButtonActive : ''}`}
            onClick={() => onStatusChange(guestId, event.id, 'attending')}
          >
            Attending
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${current.status === 'declined' ? styles.toggleButtonActive : ''}`}
            onClick={() => onStatusChange(guestId, event.id, 'declined')}
          >
            Can't make it
          </button>
        </div>
        {current.status === 'attending' &&
          event.customFields.map((f) => (
            <div key={f.id} className={styles.mealRow}>
              <label htmlFor={`f-${k}-${f.id}`}>{f.label}:</label>
              {f.type === 'single_select' ? (
                <select
                  id={`f-${k}-${f.id}`}
                  className={styles.select}
                  value={defaultValueForField(f, current.notesJson)}
                  onChange={(e) =>
                    onCustomChange(guestId, event.id, f.key, e.target.value)
                  }
                >
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`f-${k}-${f.id}`}
                  type="text"
                  className={styles.select}
                  maxLength={500}
                  value={defaultValueForField(f, current.notesJson)}
                  onChange={(e) =>
                    onCustomChange(guestId, event.id, f.key, e.target.value)
                  }
                />
              )}
            </div>
          ))}
      </>
    )
  }

  if (singleGuest) {
    const guestId = event.invitedGuestIds[0]
    return (
      <div className={styles.eventCard}>
        <div className={styles.eventCardSingle}>
          <div>
            <h2 className={styles.eventName}>{event.name}</h2>
            {(dateText || event.locationName) && (
              <div className={styles.eventMeta}>
                {dateText}
                {dateText && event.locationName ? ' · ' : ''}
                {event.locationName}
              </div>
            )}
          </div>
          {renderToggleAndCustom(guestId)}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.eventCard}>
      <h2 className={styles.eventName}>{event.name}</h2>
      {(dateText || event.locationName) && (
        <div className={styles.eventMeta}>
          {dateText}
          {dateText && event.locationName ? ' · ' : ''}
          {event.locationName}
        </div>
      )}
      {event.invitedGuestIds.map((guestId) => {
        const g = guestById.get(guestId)
        if (!g) return null
        return (
          <div key={guestId} className={styles.guestRow}>
            <div className={styles.guestName}>{g.displayName}</div>
            {renderToggleAndCustom(guestId)}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter frontend typecheck
```

Expected: failures move to `RsvpFull.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/rsvp/EventCardEditor.tsx
git commit -m "Render event custom fields generically in EventCardEditor"
```

---

### Task 11: Update `RsvpFull` to pack the new submission shape

**Files:**
- Modify: `packages/frontend/src/rsvp/RsvpFull.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingIndicator } from '../components/ui/LoadingIndicator'
import { getRsvpGroup, submitRsvp } from '../server/rsvp'
import { EventCardEditor } from './EventCardEditor'
import {
  buildInitialRsvpFormState,
  rsvpKey,
  type RsvpFormState,
} from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type {
  CustomFieldConfig,
  Guest,
  NotesJson,
  RsvpGroupResponse,
  RsvpStatus,
  RsvpSubmission,
} from '../schema'

export function RsvpFull() {
  const [code, setCode] = useState<string | null>(null)
  const [data, setData] = useState<RsvpGroupResponse | null>(null)
  const [state, setState] = useState<RsvpFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [savedThisSession, setSavedThisSession] = useState(false)

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get('code'))
  }, [])

  useEffect(() => {
    if (code === null) return
    if (code === '') {
      setLoading(false)
      setLoadError('Missing invite code.')
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getRsvpGroup(code)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setState(buildInitialRsvpFormState(res))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  const guestById = useMemo(() => {
    const m = new Map<string, Guest>()
    if (data) for (const g of data.guests) m.set(g.id, g)
    return m
  }, [data])

  function setStatus(guestId: string, eventId: string, status: RsvpStatus) {
    setState((s) => {
      if (!s) return s
      const k = rsvpKey(guestId, eventId)
      const current = s.rsvps[k] ?? { status: 'pending', notesJson: {} }
      const nextNotes = status === 'attending' ? current.notesJson : {}
      return {
        ...s,
        rsvps: { ...s.rsvps, [k]: { status, notesJson: nextNotes } },
      }
    })
  }

  function setCustom(
    guestId: string,
    eventId: string,
    fieldKey: string,
    value: string
  ) {
    setState((s) => {
      if (!s) return s
      const k = rsvpKey(guestId, eventId)
      const current = s.rsvps[k] ?? { status: 'pending', notesJson: {} }
      const nextNotes = { ...current.notesJson, [fieldKey]: value || null }
      return {
        ...s,
        rsvps: { ...s.rsvps, [k]: { ...current, notesJson: nextNotes } },
      }
    })
  }

  function setGuestCustom(guestId: string, fieldKey: string, value: string) {
    setState((s) =>
      s
        ? {
            ...s,
            guestNotesJson: {
              ...s.guestNotesJson,
              [guestId]: {
                ...(s.guestNotesJson[guestId] ?? {}),
                [fieldKey]: value || null,
              },
            },
          }
        : s
    )
  }

  function setGuestNotes(guestId: string, value: string) {
    setState((s) =>
      s
        ? {
            ...s,
            guestNotes: { ...s.guestNotes, [guestId]: value },
          }
        : s
    )
  }

  async function onSubmit() {
    if (!state || !data || !code) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const submission: RsvpSubmission = {
        respondedByGuestId: state.respondedByGuestId || data.guests[0].id,
        rsvps: Object.entries(state.rsvps).map(([k, v]) => {
          const [guestId, eventId] = k.split('::')
          return {
            guestId,
            eventId,
            status: v.status,
            notesJson: v.notesJson,
          }
        }),
        guestUpdates: data.guests.map((g) => ({
          guestId: g.id,
          notes: state.guestNotes[g.id]?.trim() || null,
          notesJson: state.guestNotesJson[g.id] ?? {},
        })),
      }
      await submitRsvp(code, submission)
      setSavedThisSession(true)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const primaryGuestId = data?.guests[0]?.id
  const hasPriorRsvp =
    data?.rsvps.some((r) => r.respondedAt !== null) ?? false
  const showSaveLabel = hasPriorRsvp || savedThisSession

  function renderGuestCustomField(g: Guest, f: CustomFieldConfig) {
    const v = state?.guestNotesJson[g.id]?.[f.key]
    const value = typeof v === 'string' ? v : ''
    if (f.type === 'single_select') {
      return (
        <select
          className={styles.select}
          value={value}
          onChange={(e) => setGuestCustom(g.id, f.key, e.target.value)}
        >
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input
        type="text"
        className={styles.select}
        maxLength={500}
        value={value}
        onChange={(e) => setGuestCustom(g.id, f.key, e.target.value)}
      />
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <a href="/" className={styles.backLink}>
          ← Back to home
        </a>

        {loading && <LoadingIndicator label="Loading your invitation…" />}
        {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

        {data && state && !submitted && (
          <>
            <h1 className={styles.heading}>RSVP</h1>
            <div className={styles.subheading}>{data.group.label}</div>

            {data.events.length === 0 && (
              <p className={styles.centered}>
                No events are open for RSVP yet — check back soon.
              </p>
            )}

            {data.events.map((ev) => (
              <EventCardEditor
                key={ev.id}
                event={ev}
                guestById={guestById}
                state={state}
                singleGuest={data.guests.length === 1}
                onStatusChange={setStatus}
                onCustomChange={setCustom}
              />
            ))}

            <div className={styles.detailsCard}>
              <h2 className={styles.detailsHeading}>Other details</h2>
              {data.guests.map((g) => (
                <div key={g.id}>
                  {data.guestCustomFields.map((f) => (
                    <div key={f.id}>
                      <label className={styles.fieldLabel}>
                        {data.guests.length > 1
                          ? `${g.displayName} — ${f.label}`
                          : f.label}
                      </label>
                      {renderGuestCustomField(g, f)}
                    </div>
                  ))}
                </div>
              ))}

              {primaryGuestId && (
                <>
                  <label className={styles.fieldLabel}>
                    Anything else we should know?
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={state.guestNotes[primaryGuestId] ?? ''}
                    onChange={(e) =>
                      setGuestNotes(primaryGuestId, e.target.value)
                    }
                  />
                </>
              )}
            </div>

            <div className={styles.submitRow}>
              <button
                type="button"
                className={styles.submit}
                onClick={onSubmit}
                disabled={submitting}
              >
                {submitting
                  ? showSaveLabel
                    ? 'Saving…'
                    : 'Sending…'
                  : showSaveLabel
                    ? 'Save RSVP'
                    : 'Send RSVP'}
              </button>
            </div>
            <ErrorMessage>{submitError}</ErrorMessage>
          </>
        )}

        {submitted && (
          <div className={styles.success}>
            <h1>Thank you!</h1>
            <p>
              We've recorded your RSVP. You can return to this page any time
              before the deadline to change it.
            </p>
            <button type="button" onClick={() => setSubmitted(false)}>
              Edit RSVP
            </button>
            <a href="/" className={styles.backLink}>
              ← Back to home
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the frontend package**

```bash
pnpm --filter frontend typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/rsvp/RsvpFull.tsx
git commit -m "Render guest custom fields generically in RsvpFull"
```

---

## Phase 3 — Admin schemas, server actions, and event/group writes

### Task 12: Update admin schemas

**Files:**
- Modify: `packages/rsvp/src/schema.ts`
- Modify: `packages/rsvp/src/schema.test.ts`

- [ ] **Step 1: Replace the file**

Replace `packages/rsvp/src/schema.ts` with:

```ts
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

// ── Custom-field admin input ────────────────────────────────────────────
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

// ── Event admin input (drops mealOptions / requiresMealChoice) ──────────
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

// ── Admin display shapes ────────────────────────────────────────────────
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
```

- [ ] **Step 2: Update schema tests**

Open `packages/rsvp/src/schema.test.ts`. Replace the existing first describe block (the `adminGuestInputSchema` test that references dietary/notes) with the slimmer version below. Keep any other tests in the file.

```ts
import { describe, expect, it } from 'vitest'
import {
  adminCustomFieldInputSchema,
  adminEventInputSchema,
  adminGroupInputSchema,
  adminGuestInputSchema,
  adminImportRowSchema,
  adminImportSchema,
} from './schema'

describe('adminGuestInputSchema', () => {
  it('coerces blank email/phone/lastName to null', () => {
    const parsed = adminGuestInputSchema.parse({
      firstName: 'Alice',
      lastName: '',
      email: '',
      phone: '',
    })
    expect(parsed.email).toBeNull()
    expect(parsed.phone).toBeNull()
    expect(parsed.lastName).toBeNull()
  })

  it('rejects invalid emails', () => {
    expect(() =>
      adminGuestInputSchema.parse({ firstName: 'Alice', email: 'nope' })
    ).toThrow()
  })
})

describe('adminCustomFieldInputSchema', () => {
  it('accepts a short_text field with no options', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'dietary_restrictions',
        label: 'Dietary',
        type: 'short_text',
      })
    ).not.toThrow()
  })

  it('rejects options on a short_text field', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'foo',
        label: 'Foo',
        type: 'short_text',
        options: [{ label: 'A' }],
      })
    ).toThrow()
  })

  it('rejects keys with uppercase or hyphens', () => {
    expect(() =>
      adminCustomFieldInputSchema.parse({
        key: 'Meal-Choice',
        label: 'Meal',
        type: 'single_select',
      })
    ).toThrow()
  })
})
```

(Leave any pre-existing `adminGroupInputSchema`/`adminEventInputSchema`/`adminImportSchema` tests in the file. Remove tests that referenced fields we deleted such as `dietaryRestrictions` or `requiresMealChoice` / `mealOptions`.)

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run packages/rsvp/src/schema.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/schema.ts packages/rsvp/src/schema.test.ts
git commit -m "Generalize admin schemas around customFields"
```

---

### Task 13: Update `saveEvent` / `listEvents`

**Files:**
- Modify: `packages/rsvp/src/server/admin/events.ts`

- [ ] **Step 1: Replace the file**

```ts
'use server'

import { getDb, loadEventCustomFields, newId } from 'db'
import { getEnv } from 'db/context'
import { RscActionError } from 'rsc-utils/functions/server'
import { adminEventInputSchema, type AdminEventInput } from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export interface AdminEventRecord extends AdminEventInput {
  id: string
}

export async function listEvents(): Promise<{ events: AdminEventRecord[] }> {
  const db = getDbConn()
  const events = await db
    .selectFrom('event')
    .selectAll()
    .orderBy('sort_order')
    .execute()
  if (events.length === 0) return { events: [] }
  const customFieldsByEvent = await loadEventCustomFields(
    db,
    events.map((e) => e.id)
  )
  return {
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      locationName: e.location_name,
      address: e.address,
      rsvpDeadline: e.rsvp_deadline,
      sortOrder: e.sort_order,
      customFields: customFieldsByEvent.get(e.id) ?? [],
    })),
  }
}

export async function saveEvent(
  input: AdminEventInput
): Promise<{ id: string }> {
  const parsed = adminEventInputSchema.safeParse(input)
  if (!parsed.success) throw new RscActionError(400, 'Invalid event data')
  const data = parsed.data

  const db = getDbConn()
  const id = data.id ?? newId('evt')
  const sortOrder = data.sortOrder ?? 0

  if (data.id) {
    await db
      .updateTable('event')
      .set({
        name: data.name,
        slug: data.slug,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        location_name: data.locationName ?? null,
        address: data.address ?? null,
        rsvp_deadline: data.rsvpDeadline ?? null,
        sort_order: sortOrder,
      })
      .where('id', '=', data.id)
      .execute()
  } else {
    const slugConflict = await db
      .selectFrom('event')
      .select(['id'])
      .where('slug', '=', data.slug)
      .executeTakeFirst()
    if (slugConflict) throw new RscActionError(409, 'Event slug already exists')
    await db
      .insertInto('event')
      .values({
        id,
        name: data.name,
        slug: data.slug,
        starts_at: data.startsAt ?? null,
        ends_at: data.endsAt ?? null,
        location_name: data.locationName ?? null,
        address: data.address ?? null,
        rsvp_deadline: data.rsvpDeadline ?? null,
        sort_order: sortOrder,
      })
      .execute()
  }

  // Diff custom fields: delete any not in submission, upsert the rest.
  const submittedFieldIds = new Set(
    data.customFields.map((f) => f.id).filter((x): x is string => !!x)
  )
  const existing = await db
    .selectFrom('event_custom_field')
    .select(['id'])
    .where('event_id', '=', id)
    .execute()
  for (const ex of existing) {
    if (!submittedFieldIds.has(ex.id)) {
      await db
        .deleteFrom('event_custom_field')
        .where('id', '=', ex.id)
        .execute()
    }
  }

  for (const f of data.customFields) {
    const fieldId = f.id ?? newId('ecf')
    if (f.id) {
      await db
        .updateTable('event_custom_field')
        .set({
          key: f.key,
          label: f.label,
          type: f.type,
          sort_order: f.sortOrder,
        })
        .where('id', '=', f.id)
        .execute()
    } else {
      await db
        .insertInto('event_custom_field')
        .values({
          id: fieldId,
          event_id: id,
          key: f.key,
          label: f.label,
          type: f.type,
          sort_order: f.sortOrder,
        })
        .execute()
    }

    // Diff options for single_select fields.
    const submittedOptionIds = new Set(
      f.options.map((o) => o.id).filter((x): x is string => !!x)
    )
    const existingOptions = await db
      .selectFrom('event_custom_field_option')
      .select(['id'])
      .where('field_id', '=', fieldId)
      .execute()
    for (const eo of existingOptions) {
      if (!submittedOptionIds.has(eo.id)) {
        await db
          .deleteFrom('event_custom_field_option')
          .where('id', '=', eo.id)
          .execute()
      }
    }
    for (const o of f.options) {
      if (o.id) {
        await db
          .updateTable('event_custom_field_option')
          .set({
            label: o.label,
            description: o.description ?? null,
            sort_order: o.sortOrder,
          })
          .where('id', '=', o.id)
          .execute()
      } else {
        await db
          .insertInto('event_custom_field_option')
          .values({
            id: newId('ecfo'),
            field_id: fieldId,
            label: o.label,
            description: o.description ?? null,
            sort_order: o.sortOrder,
          })
          .execute()
      }
    }
  }

  return { id }
}

export async function deleteEvent(id: string): Promise<{ ok: true }> {
  if (!id) throw new RscActionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('event').where('id', '=', id).execute()
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: failures localised to the admin reads/writes — fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/server/admin/events.ts
git commit -m "Move events admin to custom-fields config writes"
```

---

### Task 14: Update `saveGroup` / `getGroup` / `listGroups`

**Files:**
- Modify: `packages/rsvp/src/server/admin/groups.ts`

- [ ] **Step 1: Replace the file**

```ts
'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadGuestCustomFields,
  newId,
  newInviteCode,
  nowIso,
} from 'db'
import { getEnv } from 'db/context'
import { RscActionError } from 'rsc-utils/functions/server'
import {
  adminGroupInputSchema,
  type AdminGroupInput,
  type AdminGroupListItem,
  type AdminGuestEventStatus,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function listGroups(): Promise<{
  groups: AdminGroupListItem[]
  guestCustomFields: Awaited<ReturnType<typeof loadGuestCustomFields>>
}> {
  const db = getDbConn()

  const leaders = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', 'is', null)
    .orderBy('group_label')
    .execute()
  if (leaders.length === 0) {
    return { groups: [], guestCustomFields: await loadGuestCustomFields(db) }
  }
  const leaderIds = leaders.map((l) => l.id)

  const members = await db
    .selectFrom('guest')
    .select([
      'id',
      'party_leader_id',
      'display_name',
      'email',
      'first_name',
      'last_name',
      'invite_code',
    ])
    .where('party_leader_id', 'in', leaderIds)
    .orderBy('first_name')
    .execute()

  const invitations = await db
    .selectFrom('invitation')
    .select(['id', 'guest_id', 'event_id'])
    .where('guest_id', 'in', leaderIds)
    .execute()

  const allGuestIds = [...leaderIds, ...members.map((m) => m.id)]

  const latestRsvps = await latestRsvpResponses(db, { guestIds: allGuestIds })
  const latestGuests = await latestGuestResponses(db, { guestIds: allGuestIds })
  const latestRsvpKey = (g: string, e: string) => `${g}::${e}`
  const latestRsvpMap = new Map(
    latestRsvps.map((r) => [latestRsvpKey(r.guestId, r.eventId), r])
  )
  const latestGuestMap = new Map(latestGuests.map((r) => [r.guestId, r]))
  const guestCustomFields = await loadGuestCustomFields(db)

  const items: AdminGroupListItem[] = leaders.map((leader) => {
    const groupMembers = members.filter((m) => m.party_leader_id === leader.id)
    const allGroupGuests = [
      {
        id: leader.id,
        display_name: leader.display_name,
        email: leader.email,
        invite_code: leader.invite_code,
      },
      ...groupMembers,
    ]
    const groupGuestIds = new Set(allGroupGuests.map((g) => g.id))
    const groupRsvps = latestRsvps.filter((r) => groupGuestIds.has(r.guestId))
    const groupInvitations = invitations.filter((i) => i.guest_id === leader.id)

    return {
      id: leader.id,
      label: leader.group_label ?? '',
      guestCount: allGroupGuests.length,
      attendingCount: groupRsvps.filter((r) => r.status === 'attending').length,
      declinedCount: groupRsvps.filter((r) => r.status === 'declined').length,
      pendingCount:
        allGroupGuests.length * groupInvitations.length -
        groupRsvps.length,
      updatedAt: leader.updated_at,
      guests: allGroupGuests.map((gst) => {
        const eventStatuses: AdminGuestEventStatus[] = []
        for (const inv of groupInvitations) {
          const r = latestRsvpMap.get(latestRsvpKey(gst.id, inv.event_id))
          eventStatuses.push({
            eventId: inv.event_id,
            status: r?.status ?? 'pending',
            notesJson: parseNotesJson(r?.notesJson ?? null),
          })
        }
        const lg = latestGuestMap.get(gst.id)
        return {
          id: gst.id,
          displayName: gst.display_name,
          email: gst.email,
          inviteCode: gst.invite_code,
          notes: lg?.notes ?? null,
          notesJson: parseNotesJson(lg?.notesJson ?? null),
          eventStatuses,
        }
      }),
    }
  })
  return { groups: items, guestCustomFields }
}

export async function saveGroup(
  input: AdminGroupInput
): Promise<{ id: string }> {
  const parsed = adminGroupInputSchema.safeParse(input)
  if (!parsed.success) throw new RscActionError(400, 'Invalid group data')
  const data = parsed.data

  const db = getDbConn()
  const now = nowIso()
  const leaderId = data.id ?? newId('gst')
  const isUpdate = !!data.id

  if (isUpdate) {
    await db
      .updateTable('guest')
      .set({
        group_label: data.label,
        updated_at: now,
      })
      .where('id', '=', leaderId)
      .execute()
  } else {
    const first = data.guests[0]
    const displayName = `${first.firstName}${first.lastName ? ` ${first.lastName}` : ''}`
    await db
      .insertInto('guest')
      .values({
        id: leaderId,
        party_leader_id: null,
        first_name: first.firstName,
        last_name: first.lastName ?? null,
        display_name: displayName,
        email: first.email ? first.email : null,
        phone: first.phone ?? null,
        invite_code: newInviteCode(),
        group_label: data.label,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }

  const existingMembers = await db
    .selectFrom('guest')
    .select(['id'])
    .where((eb) =>
      eb.or([eb('id', '=', leaderId), eb('party_leader_id', '=', leaderId)])
    )
    .execute()
  const submittedIds = new Set(
    data.guests.map((g) => g.id).filter((x): x is string => !!x)
  )
  if (!isUpdate) submittedIds.add(leaderId)
  for (const eg of existingMembers) {
    if (!submittedIds.has(eg.id)) {
      await db.deleteFrom('guest').where('id', '=', eg.id).execute()
    }
  }

  for (let i = 0; i < data.guests.length; i++) {
    const g = data.guests[i]
    const isLeaderRow = isUpdate ? g.id === leaderId : i === 0
    const id = isLeaderRow ? leaderId : (g.id ?? newId('gst'))
    const displayName = `${g.firstName}${g.lastName ? ` ${g.lastName}` : ''}`

    if (g.id && submittedIds.has(g.id)) {
      await db
        .updateTable('guest')
        .set({
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          group_label: data.label,
          updated_at: now,
        })
        .where('id', '=', g.id)
        .execute()
    } else if (!isLeaderRow) {
      await db
        .insertInto('guest')
        .values({
          id,
          party_leader_id: leaderId,
          first_name: g.firstName,
          last_name: g.lastName ?? null,
          display_name: displayName,
          email: g.email ? g.email : null,
          phone: g.phone ?? null,
          invite_code: newInviteCode(),
          group_label: data.label,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  await db.deleteFrom('invitation').where('guest_id', '=', leaderId).execute()
  for (const eventId of data.invitedEventIds ?? []) {
    await db
      .insertInto('invitation')
      .values({
        id: newId('inv'),
        guest_id: leaderId,
        event_id: eventId,
      })
      .execute()
  }

  return { id: leaderId }
}

export async function getGroup(
  id: string
): Promise<AdminGroupInput & { id: string }> {
  if (!id) throw new RscActionError(400, 'Missing id')
  const db = getDbConn()

  const leader = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .where('party_leader_id', 'is', null)
    .executeTakeFirst()
  if (!leader) throw new RscActionError(404, 'Not found')

  const members = await db
    .selectFrom('guest')
    .selectAll()
    .where('party_leader_id', '=', id)
    .execute()
  const allGuests = [leader, ...members]

  const invitations = await db
    .selectFrom('invitation')
    .select(['event_id'])
    .where('guest_id', '=', id)
    .execute()

  return {
    id: leader.id,
    label: leader.group_label ?? '',
    invitedEventIds: invitations.map((i) => i.event_id),
    guests: allGuests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      email: g.email,
      phone: g.phone,
    })),
  }
}

export async function deleteGroup(id: string): Promise<{ ok: true }> {
  if (!id) throw new RscActionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('guest').where('id', '=', id).execute()
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: still failures in `guests.ts`, `responses.ts`, the routes — fixed next.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/server/admin/groups.ts
git commit -m "Read groups from latest responses + drop dietary/notes writes"
```

---

### Task 15: Update `getGuest`

**Files:**
- Modify: `packages/rsvp/src/server/admin/guests.ts`

- [ ] **Step 1: Replace the file**

```ts
'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
} from 'db'
import { getEnv } from 'db/context'
import { RscActionError } from 'rsc-utils/functions/server'
import type { AdminGuestDetail, CustomFieldConfig } from '../../schema'
import type { CustomFieldConfig as DbCustomFieldConfig } from 'db'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function getGuest(id: string): Promise<
  AdminGuestDetail & {
    guestCustomFields: CustomFieldConfig[]
    eventCustomFieldsByEvent: Record<string, CustomFieldConfig[]>
  }
> {
  if (!id) throw new RscActionError(400, 'Missing id')
  const db = getDbConn()

  const guest = await db
    .selectFrom('guest')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
  if (!guest) throw new RscActionError(404, 'Guest not found')

  let groupLabel = guest.group_label ?? ''
  const leaderId = guest.party_leader_id ?? guest.id

  if (!groupLabel && guest.party_leader_id) {
    const leader = await db
      .selectFrom('guest')
      .select(['group_label'])
      .where('id', '=', guest.party_leader_id)
      .executeTakeFirst()
    groupLabel = leader?.group_label ?? ''
  }

  const invitations = await db
    .selectFrom('invitation')
    .innerJoin('event', 'event.id', 'invitation.event_id')
    .select([
      'invitation.event_id as eventId',
      'event.name as eventName',
      'event.sort_order as sortOrder',
    ])
    .where('invitation.guest_id', '=', leaderId)
    .orderBy('event.sort_order')
    .execute()

  const eventIds = invitations.map((i) => i.eventId)

  const latestRsvps = await latestRsvpResponses(db, {
    guestIds: [id],
    eventIds,
  })
  const latestGuests = await latestGuestResponses(db, { guestIds: [id] })
  const lg = latestGuests[0]

  // Pull responder display names in one go.
  const responderIds = Array.from(
    new Set(
      latestRsvps
        .map((r) => r.respondedByGuestId)
        .filter((x): x is string => !!x)
    )
  )
  const responders = responderIds.length
    ? await db
        .selectFrom('guest')
        .select(['id', 'display_name'])
        .where('id', 'in', responderIds)
        .execute()
    : []
  const responderName = new Map(responders.map((r) => [r.id, r.display_name]))

  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)
  const guestCustomFields = await loadGuestCustomFields(db)

  const events = invitations.map((inv) => {
    const r = latestRsvps.find((x) => x.eventId === inv.eventId)
    return {
      eventId: inv.eventId,
      eventName: inv.eventName,
      status: r?.status ?? 'pending',
      notesJson: parseNotesJson(r?.notesJson ?? null),
      respondedAt: r?.respondedAt ?? null,
      respondedByDisplayName: r?.respondedByGuestId
        ? (responderName.get(r.respondedByGuestId) ?? null)
        : null,
    }
  })

  // Db's CustomFieldConfig has the same shape as our admin schema's; cast to the schema's type.
  const toAdminCfg = (c: DbCustomFieldConfig): CustomFieldConfig => c

  return {
    id: guest.id,
    displayName: guest.display_name,
    email: guest.email,
    phone: guest.phone,
    inviteCode: guest.invite_code,
    notes: lg?.notes ?? null,
    notesJson: parseNotesJson(lg?.notesJson ?? null),
    groupLabel,
    events,
    guestCustomFields: guestCustomFields.map(toAdminCfg),
    eventCustomFieldsByEvent: Object.fromEntries(
      [...eventCustomFieldsByEvent.entries()].map(([k, v]) => [
        k,
        v.map(toAdminCfg),
      ])
    ),
  }
}
```

- [ ] **Step 2: Add `CustomFieldConfig` to admin schema exports**

Open `packages/rsvp/src/schema.ts`. Append at the end:

```ts
export const customFieldOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
})

export const customFieldConfigSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.enum(['short_text', 'single_select']),
  sortOrder: z.number(),
  options: z.array(customFieldOptionSchema),
})
export type CustomFieldOption = z.infer<typeof customFieldOptionSchema>
export type CustomFieldConfig = z.infer<typeof customFieldConfigSchema>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: still failures in `responses.ts` and admin route components — fixed next.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/server/admin/guests.ts packages/rsvp/src/schema.ts
git commit -m "Read guest detail from latest responses + custom field configs"
```

---

### Task 16: Update `responses.ts` (CSV current-state + new log endpoints)

**Files:**
- Modify: `packages/rsvp/src/server/admin/responses.ts`

- [ ] **Step 1: Replace the file**

```ts
'use server'

import {
  getDb,
  latestGuestResponses,
  latestRsvpResponses,
  loadEventCustomFields,
  loadGuestCustomFields,
  type CustomFieldConfig as DbCustomFieldConfig,
} from 'db'
import { getEnv } from 'db/context'
import type {
  AdminResponseRow,
  CustomFieldConfig,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

function parseNotesJson(raw: string | null): Record<string, string | null> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function formatCustomAnswersForCsv(
  notesJson: Record<string, string | null>,
  fields: DbCustomFieldConfig[]
): string {
  if (fields.length === 0) return ''
  const parts: string[] = []
  for (const f of fields) {
    const raw = notesJson[f.key]
    if (raw == null) continue
    let value = raw
    if (f.type === 'single_select') {
      const opt = f.options.find((o) => o.id === raw)
      value = opt ? opt.label : `(unknown ${raw})`
    }
    parts.push(`${f.label}: ${value}`)
  }
  return parts.join('; ')
}

export async function listResponses(): Promise<{ rows: AdminResponseRow[] }> {
  const db = getDbConn()

  const guests = await db
    .selectFrom('guest')
    .select([
      'id as guestId',
      'display_name as guestName',
      'invite_code as inviteCode',
      'party_leader_id as partyLeaderId',
      'group_label as groupLabel',
    ])
    .execute()

  const events = await db
    .selectFrom('event')
    .select(['id', 'name', 'sort_order'])
    .orderBy('sort_order')
    .execute()
  const eventById = new Map(events.map((e) => [e.id, e]))
  const eventIds = events.map((e) => e.id)
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)

  const invitations = await db
    .selectFrom('invitation')
    .select(['guest_id', 'event_id'])
    .execute()

  const latestRsvps = await latestRsvpResponses(db)
  const rsvpKey = (g: string, e: string) => `${g}::${e}`
  const rsvpMap = new Map(
    latestRsvps.map((r) => [rsvpKey(r.guestId, r.eventId), r])
  )

  const latestGuests = await latestGuestResponses(db)
  const guestRespMap = new Map(latestGuests.map((r) => [r.guestId, r]))

  const out: AdminResponseRow[] = []
  for (const g of guests) {
    const leaderId = g.partyLeaderId ?? g.guestId
    const eventIdsForGroup = invitations
      .filter((i) => i.guest_id === leaderId)
      .map((i) => i.event_id)
    for (const eid of eventIdsForGroup) {
      const ev = eventById.get(eid)
      if (!ev) continue
      const r = rsvpMap.get(rsvpKey(g.guestId, eid))
      const lg = guestRespMap.get(g.guestId)
      const customAnswers = formatCustomAnswersForCsv(
        parseNotesJson(r?.notesJson ?? null),
        eventCustomFieldsByEvent.get(eid) ?? []
      )
      out.push({
        groupLabel: g.groupLabel ?? '',
        inviteCode: g.inviteCode,
        guestName: g.guestName,
        eventName: ev.name,
        status: r?.status ?? 'pending',
        customAnswers,
        notes: lg?.notes ?? null,
        respondedAt: r?.respondedAt ?? null,
      })
    }
  }
  return { rows: out }
}

export interface AdminRsvpResponseLogRow {
  id: string
  respondedAt: string
  guestName: string
  eventName: string
  status: 'attending' | 'declined'
  notesJson: Record<string, string | null>
  respondedByDisplayName: string | null
  eventCustomFields: CustomFieldConfig[]
}

export async function listRsvpResponseLog(): Promise<{
  rows: AdminRsvpResponseLogRow[]
}> {
  const db = getDbConn()
  const rows = await db
    .selectFrom('rsvp_response')
    .innerJoin('guest', 'guest.id', 'rsvp_response.guest_id')
    .innerJoin('event', 'event.id', 'rsvp_response.event_id')
    .leftJoin(
      'guest as responder',
      'responder.id',
      'rsvp_response.responded_by_guest_id'
    )
    .select([
      'rsvp_response.id as id',
      'rsvp_response.responded_at as respondedAt',
      'rsvp_response.event_id as eventId',
      'rsvp_response.status as status',
      'rsvp_response.notes_json as notesJson',
      'guest.display_name as guestName',
      'event.name as eventName',
      'responder.display_name as responderName',
    ])
    .orderBy('rsvp_response.responded_at', 'desc')
    .execute()

  const eventIds = Array.from(new Set(rows.map((r) => r.eventId)))
  const eventCustomFieldsByEvent = await loadEventCustomFields(db, eventIds)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      respondedAt: r.respondedAt,
      guestName: r.guestName,
      eventName: r.eventName,
      status: r.status,
      notesJson: parseNotesJson(r.notesJson),
      respondedByDisplayName: r.responderName ?? null,
      eventCustomFields: eventCustomFieldsByEvent.get(r.eventId) ?? [],
    })),
  }
}

export interface AdminGuestResponseLogRow {
  id: string
  respondedAt: string
  guestName: string
  notes: string | null
  notesJson: Record<string, string | null>
  respondedByDisplayName: string | null
}

export async function listGuestResponseLog(): Promise<{
  rows: AdminGuestResponseLogRow[]
  guestCustomFields: CustomFieldConfig[]
}> {
  const db = getDbConn()
  const rows = await db
    .selectFrom('guest_response')
    .innerJoin('guest', 'guest.id', 'guest_response.guest_id')
    .leftJoin(
      'guest as responder',
      'responder.id',
      'guest_response.responded_by_guest_id'
    )
    .select([
      'guest_response.id as id',
      'guest_response.responded_at as respondedAt',
      'guest.display_name as guestName',
      'guest_response.notes as notes',
      'guest_response.notes_json as notesJson',
      'responder.display_name as responderName',
    ])
    .orderBy('guest_response.responded_at', 'desc')
    .execute()
  const guestCustomFields = await loadGuestCustomFields(db)
  return {
    rows: rows.map((r) => ({
      id: r.id,
      respondedAt: r.respondedAt,
      guestName: r.guestName,
      notes: r.notes,
      notesJson: parseNotesJson(r.notesJson),
      respondedByDisplayName: r.responderName ?? null,
    })),
    guestCustomFields,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: route components still fail; we'll fix them in Phase 5.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/server/admin/responses.ts
git commit -m "Update CSV listResponses; add Log server actions"
```

---

## Phase 4 — Custom-field admin server actions

### Task 17: `customFields.ts` server actions

**Files:**
- Create: `packages/rsvp/src/server/admin/customFields.ts`

- [ ] **Step 1: Implement**

```ts
'use server'

import { getDb, loadGuestCustomFields, newId } from 'db'
import { getEnv } from 'db/context'
import { RscActionError } from 'rsc-utils/functions/server'
import {
  adminCustomFieldInputSchema,
  type AdminCustomFieldInput,
  type CustomFieldConfig,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export async function listGuestCustomFields(): Promise<{
  fields: CustomFieldConfig[]
}> {
  const db = getDbConn()
  return { fields: await loadGuestCustomFields(db) }
}

export async function saveGuestCustomField(
  input: AdminCustomFieldInput
): Promise<{ id: string }> {
  const parsed = adminCustomFieldInputSchema.safeParse(input)
  if (!parsed.success) throw new RscActionError(400, 'Invalid field data')
  const data = parsed.data
  const db = getDbConn()
  const fieldId = data.id ?? newId('gcf')

  if (data.id) {
    await db
      .updateTable('guest_custom_field')
      .set({
        key: data.key,
        label: data.label,
        type: data.type,
        sort_order: data.sortOrder,
      })
      .where('id', '=', data.id)
      .execute()
  } else {
    const conflict = await db
      .selectFrom('guest_custom_field')
      .select(['id'])
      .where('key', '=', data.key)
      .executeTakeFirst()
    if (conflict) throw new RscActionError(409, 'Key already in use')
    await db
      .insertInto('guest_custom_field')
      .values({
        id: fieldId,
        key: data.key,
        label: data.label,
        type: data.type,
        sort_order: data.sortOrder,
      })
      .execute()
  }

  // Diff options.
  const submittedOptionIds = new Set(
    data.options.map((o) => o.id).filter((x): x is string => !!x)
  )
  const existing = await db
    .selectFrom('guest_custom_field_option')
    .select(['id'])
    .where('field_id', '=', fieldId)
    .execute()
  for (const eo of existing) {
    if (!submittedOptionIds.has(eo.id)) {
      await db
        .deleteFrom('guest_custom_field_option')
        .where('id', '=', eo.id)
        .execute()
    }
  }
  for (const o of data.options) {
    if (o.id) {
      await db
        .updateTable('guest_custom_field_option')
        .set({
          label: o.label,
          description: o.description ?? null,
          sort_order: o.sortOrder,
        })
        .where('id', '=', o.id)
        .execute()
    } else {
      await db
        .insertInto('guest_custom_field_option')
        .values({
          id: newId('gcfo'),
          field_id: fieldId,
          label: o.label,
          description: o.description ?? null,
          sort_order: o.sortOrder,
        })
        .execute()
    }
  }

  return { id: fieldId }
}

export async function deleteGuestCustomField(
  id: string
): Promise<{ ok: true }> {
  if (!id) throw new RscActionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('guest_custom_field').where('id', '=', id).execute()
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS for `customFields.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/server/admin/customFields.ts
git commit -m "Add guest custom-field admin server actions"
```

---

## Phase 5 — Admin UI: events page, custom-field editor, group editor cleanup

### Task 18: `CustomFieldsEditor` shared component

**Files:**
- Create: `packages/rsvp/src/admin/routes/CustomFieldsEditor.tsx`
- Create: `packages/rsvp/src/admin/routes/CustomFieldsEditor.module.css`

- [ ] **Step 1: Implement the editor**

Create `packages/rsvp/src/admin/routes/CustomFieldsEditor.tsx`:

```tsx
'use client'

import { Button } from '../../components/ui/Button'
import { FieldGroup } from '../../components/ui/FieldGroup'
import { FormGrid } from '../../components/ui/FormGrid'
import { RemoveButton } from '../../components/ui/RemoveButton'
import styles from './CustomFieldsEditor.module.css'
import type { AdminCustomFieldInput } from '../../schema'

interface CustomFieldsEditorProps {
  fields: AdminCustomFieldInput[]
  onChange: (next: AdminCustomFieldInput[]) => void
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: CustomFieldsEditorProps) {
  function update(idx: number, patch: Partial<AdminCustomFieldInput>) {
    const next = [...fields]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  function add() {
    onChange([
      ...fields,
      {
        key: '',
        label: '',
        type: 'short_text',
        sortOrder: fields.length,
        options: [],
      },
    ])
  }

  function remove(idx: number) {
    onChange(fields.filter((_, i) => i !== idx))
  }

  function setOptions(
    fieldIdx: number,
    next: AdminCustomFieldInput['options']
  ) {
    update(fieldIdx, { options: next })
  }

  return (
    <div className={styles.editor}>
      {fields.map((f, idx) => (
        <div key={f.id ?? `new-${idx}`} className={styles.fieldBlock}>
          <FormGrid cols={3}>
            <FieldGroup label="Label">
              <input
                className="admin-input"
                value={f.label}
                onChange={(e) => {
                  const label = e.target.value
                  const next: Partial<AdminCustomFieldInput> = { label }
                  // Auto-slug only if user hasn't customised the key.
                  if (!f.id && (f.key === '' || f.key === slugify(f.label))) {
                    next.key = slugify(label)
                  }
                  update(idx, next)
                }}
              />
            </FieldGroup>
            <FieldGroup label="Key" hint="snake_case, used in stored answers">
              <input
                className="admin-input"
                value={f.key}
                onChange={(e) => update(idx, { key: e.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="Type">
              <select
                className="admin-input"
                value={f.type}
                onChange={(e) =>
                  update(idx, {
                    type: e.target.value as AdminCustomFieldInput['type'],
                    options:
                      e.target.value === 'single_select' ? f.options : [],
                  })
                }
              >
                <option value="short_text">Short text</option>
                <option value="single_select">Single select</option>
              </select>
            </FieldGroup>
          </FormGrid>

          {f.type === 'single_select' && (
            <div className={styles.options}>
              {f.options.map((o, oi) => (
                <div key={o.id ?? `new-${oi}`} className={styles.optionRow}>
                  <input
                    className="admin-input"
                    placeholder="Option label"
                    value={o.label}
                    onChange={(e) => {
                      const next = [...f.options]
                      next[oi] = { ...next[oi], label: e.target.value }
                      setOptions(idx, next)
                    }}
                  />
                  <RemoveButton
                    label="Remove option"
                    onClick={() =>
                      setOptions(
                        idx,
                        f.options.filter((_, i) => i !== oi)
                      )
                    }
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() =>
                  setOptions(idx, [
                    ...f.options,
                    {
                      label: '',
                      description: null,
                      sortOrder: f.options.length,
                    },
                  ])
                }
              >
                + Add option
              </Button>
            </div>
          )}

          <div className={styles.fieldFooter}>
            <RemoveButton label="Remove field" onClick={() => remove(idx)} />
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={add}>
        + Add custom field
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Add styles**

Create `packages/rsvp/src/admin/routes/CustomFieldsEditor.module.css`:

```css
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fieldBlock {
  border: 1px solid var(--admin-border, #e6e8eb);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--admin-card-bg, #fff);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 12px;
  border-left: 2px solid var(--admin-border, #e6e8eb);
}

.optionRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.fieldFooter {
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS for these new files.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/admin/routes/CustomFieldsEditor.tsx packages/rsvp/src/admin/routes/CustomFieldsEditor.module.css
git commit -m "Add CustomFieldsEditor shared component"
```

---

### Task 19: Replace meal-options block in `EditEventForm`

**Files:**
- Modify: `packages/rsvp/src/admin/routes/EditEventForm.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import { Button } from '../../components/ui/Button'
import { EditFormActions } from '../../components/ui/EditFormActions'
import { EditFormSection } from '../../components/ui/EditFormSection'
import { EditFormShell } from '../../components/ui/EditFormShell'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { FieldGroup } from '../../components/ui/FieldGroup'
import { FormGrid } from '../../components/ui/FormGrid'
import { SectionLabel } from '../../components/ui/SectionLabel'
import { isoToLocalInput, localInputToIso } from '../lib/dateHelpers'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import type { AdminEventInput } from '../../schema'

interface EditEventFormProps {
  event: AdminEventInput
  saving: boolean
  error: string | null
  onChange: (next: AdminEventInput) => void
  onSave: () => void
  onCancel: () => void
}

export function EditEventForm({
  event,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: EditEventFormProps) {
  return (
    <EditFormShell
      title={event.id ? 'Edit event' : 'New event'}
      onBack={onCancel}
    >
      <ErrorMessage>{error}</ErrorMessage>

      <EditFormSection>
        <SectionLabel>Details</SectionLabel>
        <FormGrid cols={2}>
          <FieldGroup label="Name">
            <input
              className="admin-input"
              value={event.name}
              onChange={(e) => onChange({ ...event, name: e.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="Slug" hint="lowercase, no spaces">
            <input
              className="admin-input"
              value={event.slug}
              onChange={(e) => onChange({ ...event, slug: e.target.value })}
            />
          </FieldGroup>
        </FormGrid>
        <FormGrid cols={2} style={{ marginTop: 12 }}>
          <FieldGroup label="Location name">
            <input
              className="admin-input"
              value={event.locationName ?? ''}
              onChange={(e) =>
                onChange({ ...event, locationName: e.target.value })
              }
            />
          </FieldGroup>
          <FieldGroup label="Address">
            <input
              className="admin-input"
              value={event.address ?? ''}
              onChange={(e) => onChange({ ...event, address: e.target.value })}
            />
          </FieldGroup>
        </FormGrid>
        <FieldGroup label="Sort order" style={{ marginTop: 12, maxWidth: 120 }}>
          <input
            className="admin-input"
            type="number"
            value={event.sortOrder}
            onChange={(e) =>
              onChange({ ...event, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </FieldGroup>
      </EditFormSection>

      <EditFormSection>
        <SectionLabel>Schedule</SectionLabel>
        <FormGrid cols={3}>
          <FieldGroup label="Starts at">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.startsAt)}
              onChange={(e) =>
                onChange({
                  ...event,
                  startsAt: localInputToIso(e.target.value),
                })
              }
            />
          </FieldGroup>
          <FieldGroup label="Ends at">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.endsAt)}
              onChange={(e) =>
                onChange({ ...event, endsAt: localInputToIso(e.target.value) })
              }
            />
          </FieldGroup>
          <FieldGroup label="RSVP deadline">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.rsvpDeadline)}
              onChange={(e) =>
                onChange({
                  ...event,
                  rsvpDeadline: localInputToIso(e.target.value),
                })
              }
            />
          </FieldGroup>
        </FormGrid>
      </EditFormSection>

      <EditFormSection>
        <SectionLabel>Custom fields</SectionLabel>
        <CustomFieldsEditor
          fields={event.customFields}
          onChange={(next) => onChange({ ...event, customFields: next })}
        />
      </EditFormSection>

      <EditFormActions>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save event'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </EditFormActions>
    </EditFormShell>
  )
}
```

- [ ] **Step 2: Delete the no-longer-used CSS**

Open `packages/rsvp/src/admin/routes/EditEventForm.module.css` and remove the `.checkboxLabel` and `.mealOptionRow` rules if they exist. (They referenced the meal options UI we just replaced.) Leave the rest of the file alone.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS for `EditEventForm.tsx`.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/admin/routes/EditEventForm.tsx packages/rsvp/src/admin/routes/EditEventForm.module.css
git commit -m "Replace meal-options UI with CustomFieldsEditor"
```

---

### Task 20: Add "Guest profile fields" section to `EventSettings`

**Files:**
- Modify: `packages/rsvp/src/admin/routes/EventSettings.tsx`

- [ ] **Step 1: Read current file**

(Familiarise yourself with the existing layout — open the file in your editor.)

- [ ] **Step 2: Add the section above the events list**

At the top of `EventSettings` (the page component), before the events list rendering, insert a new section that renders the global guest custom fields. The exact existing structure depends on the file; the change is conceptually:

```tsx
// At top imports
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import {
  deleteGuestCustomField,
  listGuestCustomFields,
  saveGuestCustomField,
} from '../../server/admin/customFields'
import type { AdminCustomFieldInput, CustomFieldConfig } from '../../schema'

// Inside the component, alongside the existing event-list state:
const [guestFields, setGuestFields] = useState<CustomFieldConfig[]>([])
const [guestFieldsDraft, setGuestFieldsDraft] = useState<AdminCustomFieldInput[]>([])
const [guestFieldsDirty, setGuestFieldsDirty] = useState(false)
const [guestFieldsError, setGuestFieldsError] = useState<string | null>(null)
const [guestFieldsSaving, setGuestFieldsSaving] = useState(false)

useEffect(() => {
  ;(async () => {
    const r = await listGuestCustomFields()
    setGuestFields(r.fields)
    setGuestFieldsDraft(
      r.fields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        sortOrder: f.sortOrder,
        options: f.options.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
          sortOrder: 0,
        })),
      }))
    )
  })()
}, [])

async function saveGuestFields() {
  setGuestFieldsSaving(true)
  setGuestFieldsError(null)
  try {
    // Upsert each draft.
    const submittedIds = new Set(
      guestFieldsDraft.map((f) => f.id).filter((x): x is string => !!x)
    )
    // Delete ones that were removed in the draft.
    for (const existing of guestFields) {
      if (!submittedIds.has(existing.id)) {
        await deleteGuestCustomField(existing.id)
      }
    }
    for (let i = 0; i < guestFieldsDraft.length; i++) {
      await saveGuestCustomField({
        ...guestFieldsDraft[i],
        sortOrder: i,
      })
    }
    const fresh = await listGuestCustomFields()
    setGuestFields(fresh.fields)
    setGuestFieldsDraft(
      fresh.fields.map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        sortOrder: f.sortOrder,
        options: f.options.map((o) => ({
          id: o.id,
          label: o.label,
          description: o.description,
          sortOrder: 0,
        })),
      }))
    )
    setGuestFieldsDirty(false)
  } catch (err) {
    setGuestFieldsError(err instanceof Error ? err.message : 'Save failed')
  } finally {
    setGuestFieldsSaving(false)
  }
}

// In the JSX, render a section before the events list:
<section style={{ marginBottom: 24 }}>
  <PageHeader title="Guest profile fields" />
  <ErrorMessage>{guestFieldsError}</ErrorMessage>
  <CustomFieldsEditor
    fields={guestFieldsDraft}
    onChange={(next) => {
      setGuestFieldsDraft(next)
      setGuestFieldsDirty(true)
    }}
  />
  {guestFieldsDirty && (
    <div style={{ marginTop: 12 }}>
      <Button onClick={saveGuestFields} disabled={guestFieldsSaving}>
        {guestFieldsSaving ? 'Saving…' : 'Save guest profile fields'}
      </Button>
    </div>
  )}
</section>
```

(If the file already uses a different layout/loader pattern, mirror it. Keep the events list rendering below this new section.)

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/admin/routes/EventSettings.tsx
git commit -m "Add Guest profile fields section to Events admin page"
```

---

### Task 21: Drop dietary/notes from `EditGroupForm` defaults

**Files:**
- Modify: `packages/rsvp/src/admin/routes/EditGroupForm.tsx`

- [ ] **Step 1: Update `blankGuest`**

Find the `blankGuest` function near the top of the file and replace with:

```ts
const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})
```

- [ ] **Step 2: Update the import block**

Remove the unused fields from the import; the file imports `AdminGuestInput` which now reflects the slimmer shape.

- [ ] **Step 3: Update `GuestList`'s `blankGroup`**

Open `packages/rsvp/src/admin/routes/GuestList.tsx`. Replace `blankGuest`/`blankGroup` near the top with:

```ts
const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

const blankGroup = (): AdminGroupInput => ({
  label: '',
  guests: [blankGuest()],
  invitedEventIds: [],
})
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS for these files.

- [ ] **Step 5: Commit**

```bash
git add packages/rsvp/src/admin/routes/EditGroupForm.tsx packages/rsvp/src/admin/routes/GuestList.tsx
git commit -m "Drop dietary/notes blank-defaults from group editor"
```

---

## Phase 6 — Admin display surfaces (custom-field divider rule)

### Task 22: Custom-field rendering helpers

**Files:**
- Create: `packages/rsvp/src/admin/lib/customFieldRender.ts`

- [ ] **Step 1: Implement**

```ts
import type { CustomFieldConfig } from '../../schema'

export function buildOptionLabelMap(
  fields: CustomFieldConfig[]
): Map<string, string> {
  const out = new Map<string, string>()
  for (const f of fields) {
    if (f.type !== 'single_select') continue
    for (const o of f.options) out.set(o.id, o.label)
  }
  return out
}

export function renderCustomFieldValue(
  field: CustomFieldConfig,
  notesJson: Record<string, string | null>,
  optionLabels?: Map<string, string>
): string | null {
  const raw = notesJson[field.key]
  if (raw == null) return null
  if (field.type === 'single_select') {
    const labels =
      optionLabels ?? new Map(field.options.map((o) => [o.id, o.label]))
    return labels.get(raw) ?? `(unknown ${raw})`
  }
  return raw
}

export function formatCustomAnswers(
  fields: CustomFieldConfig[],
  notesJson: Record<string, string | null>
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const f of fields) {
    const v = renderCustomFieldValue(f, notesJson)
    if (v !== null) out.push({ label: f.label, value: v })
  }
  return out
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/admin/lib/customFieldRender.ts
git commit -m "Add custom-field rendering helpers for admin views"
```

---

### Task 23: Add `customDivider` CSS

**Files:**
- Modify: `packages/rsvp/src/admin/routes/GuestList.module.css`

- [ ] **Step 1: Append the rule**

Append to the end of `GuestList.module.css`:

```css
.customDivider {
  border-left: 2px solid var(--admin-divider, #c9cdd4) !important;
}
.customLabel {
  color: var(--admin-muted, #6b7280);
  font-size: 0.85em;
  margin-right: 4px;
}
.customCell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/rsvp/src/admin/routes/GuestList.module.css
git commit -m "Add customDivider/customCell styles"
```

---

### Task 24: Update `GroupBlock` (drop meal hint, add per-guest custom columns)

**Files:**
- Modify: `packages/rsvp/src/admin/routes/GroupBlock.tsx`
- Modify: `packages/rsvp/src/admin/routes/GuestList.tsx`

- [ ] **Step 1: Update `GroupBlock`**

Replace the file:

```tsx
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import { renderCustomFieldValue } from '../lib/customFieldRender'
import styles from './GuestList.module.css'
import type {
  AdminGroupListItem,
  CustomFieldConfig,
} from '../../schema'
import type { AdminEventRecord } from '../../server/admin/events'

interface GroupBlockProps {
  group: AdminGroupListItem
  eventColumns: AdminEventRecord[]
  guestCustomFields: CustomFieldConfig[]
  colCount: number
  onEdit: () => void
  onOpenGuest: (guestId: string) => void
}

export function GroupBlock({
  group,
  eventColumns,
  guestCustomFields,
  colCount,
  onEdit,
  onOpenGuest,
}: GroupBlockProps) {
  const showHeader = group.guestCount > 1
  return (
    <>
      {showHeader && (
        <tr className={styles.groupHeaderRow}>
          <td colSpan={colCount}>
            <div className={styles.groupHeaderContent}>
              <span className={styles.groupHeaderLabel}>{group.label}</span>
              <span className={styles.groupHeaderStats}>
                {group.guestCount} guests ·{' '}
                <StatusBadge
                  status="attending"
                  label={`${group.attendingCount} attending`}
                />{' '}
                ·{' '}
                <StatusBadge
                  status="declined"
                  label={`${group.declinedCount} declined`}
                />{' '}
                ·{' '}
                <StatusBadge
                  status="pending"
                  label={`${group.pendingCount} pending`}
                />
              </span>
            </div>
          </td>
        </tr>
      )}
      {group.guests.map((guest) => (
        <tr
          key={guest.id}
          className={styles.guestClickRow}
          onClick={() => onOpenGuest(guest.id)}
        >
          <td>{guest.displayName}</td>
          <td>
            <a
              href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(guest.inviteCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={styles.codeLink}
            >
              {guest.inviteCode}
            </a>
          </td>
          {eventColumns.map((ev) => {
            const s = guest.eventStatuses.find((es) => es.eventId === ev.id)
            return (
              <td key={ev.id} className={statusClassName(s?.status)}>
                <StatusBadge status={s?.status} />
              </td>
            )
          })}
          <td>{guest.notes ?? ''}</td>
          {guestCustomFields.map((f, i) => {
            const value = renderCustomFieldValue(f, guest.notesJson)
            return (
              <td
                key={f.id}
                className={i === 0 ? styles.customDivider : undefined}
              >
                {value ?? ''}
              </td>
            )
          })}
          <td className={styles.editCell}>
            <button
              type="button"
              className={styles.editIcon}
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title="Edit invite"
            >
              ✎
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Update `GuestList`**

Open `packages/rsvp/src/admin/routes/GuestList.tsx`. The `refresh` callback needs to capture the new `guestCustomFields` from `listGroups`. Update the relevant block:

```tsx
const [groups, setGroups] = useState<AdminGroupListItem[]>([])
const [events, setEvents] = useState<AdminEventRecord[]>([])
const [guestCustomFields, setGuestCustomFields] = useState<CustomFieldConfig[]>(
  []
)
// ...

async function refresh() {
  setLoading(true)
  setError(null)
  try {
    const [g, e] = await Promise.all([listGroups(), listEvents()])
    setGroups(g.groups)
    setGuestCustomFields(g.guestCustomFields)
    setEvents(e.events)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load')
  } finally {
    setLoading(false)
  }
}
```

Then in the JSX header row and `colCount`:

```tsx
const colCount = 2 + eventColumns.length + 1 + guestCustomFields.length + 1
// name + code + events + notes + custom + edit

// Inside <thead>:
<tr>
  <th>Name</th>
  <th>Invite code</th>
  {eventColumns.map((ev) => (
    <th key={ev.id}>{ev.name}</th>
  ))}
  <th>Notes</th>
  {guestCustomFields.map((f, i) => (
    <th
      key={f.id}
      className={i === 0 ? styles.customDivider : undefined}
    >
      {f.label}
    </th>
  ))}
  <th></th>
</tr>
```

In the `<GroupBlock>` invocation, pass the new prop:

```tsx
<GroupBlock
  key={g.id}
  group={g}
  eventColumns={eventColumns}
  guestCustomFields={guestCustomFields}
  colCount={colCount}
  onEdit={() => startEdit(g.id)}
  onOpenGuest={(guestId) => setDetailGuestId(guestId)}
/>
```

Also import `CustomFieldConfig` from `../../schema` at the top.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/admin/routes/GroupBlock.tsx packages/rsvp/src/admin/routes/GuestList.tsx
git commit -m "Render guest custom fields in outer table with divider"
```

---

### Task 25: Update `GuestDetailModal` (header + events table + drop trailing song-request)

**Files:**
- Modify: `packages/rsvp/src/admin/routes/GuestDetailModal.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import { Table } from '../../components/ui/Table'
import { getGuest } from '../../server/admin/guests'
import {
  formatCustomAnswers,
  renderCustomFieldValue,
} from '../lib/customFieldRender'
import styles from './GuestList.module.css'
import type { AdminGuestDetail, CustomFieldConfig } from '../../schema'

type GuestDetailWithFields = AdminGuestDetail & {
  guestCustomFields: CustomFieldConfig[]
  eventCustomFieldsByEvent: Record<string, CustomFieldConfig[]>
}

interface GuestDetailModalProps {
  guestId: string
  onClose: () => void
}

export function GuestDetailModal({ guestId, onClose }: GuestDetailModalProps) {
  const [data, setData] = useState<GuestDetailWithFields | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGuest(guestId)
      .then((d) => {
        if (!cancelled) setData(d as GuestDetailWithFields)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [guestId])

  const title = data?.displayName ?? 'Guest details'

  return (
    <Modal title={title} onClose={onClose}>
      <ErrorMessage>{error}</ErrorMessage>
      {!data && !error && <LoadingIndicator variant="inline" />}
      {data && (
        <>
          <div className={styles.detailGrid}>
            <div className={styles.detailLabel}>Group</div>
            <div>{data.groupLabel}</div>
            <div className={styles.detailLabel}>Invite code</div>
            <div>
              <a
                href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(data.inviteCode)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.codeLink}
              >
                {data.inviteCode}
              </a>
            </div>
            {data.email && (
              <>
                <div className={styles.detailLabel}>Email</div>
                <div>{data.email}</div>
              </>
            )}
            {data.phone && (
              <>
                <div className={styles.detailLabel}>Phone</div>
                <div>{data.phone}</div>
              </>
            )}
            {data.notes && (
              <>
                <div className={styles.detailLabel}>Notes</div>
                <div>{data.notes}</div>
              </>
            )}
          </div>

          {data.guestCustomFields.length > 0 && (
            <div
              className={`${styles.detailGrid} ${styles.customDivider}`}
              style={{ marginTop: 12, paddingLeft: 12 }}
            >
              {data.guestCustomFields.map((f) => {
                const v = renderCustomFieldValue(f, data.notesJson)
                return (
                  <div key={f.id} style={{ display: 'contents' }}>
                    <div className={styles.detailLabel}>{f.label}</div>
                    <div>{v ?? '—'}</div>
                  </div>
                )
              })}
            </div>
          )}

          <h3 className={styles.detailSubheading}>Events</h3>
          <Table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Responded</th>
                <th>By</th>
                <th className={styles.customDivider}>Custom answers</th>
              </tr>
            </thead>
            <tbody>
              {data.events.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    Not invited to any events yet.
                  </td>
                </tr>
              )}
              {data.events.map((e) => {
                const fields =
                  data.eventCustomFieldsByEvent[e.eventId] ?? []
                const answers = formatCustomAnswers(fields, e.notesJson)
                return (
                  <tr key={e.eventId}>
                    <td>{e.eventName}</td>
                    <td className={statusClassName(e.status)}>
                      <StatusBadge status={e.status} />
                    </td>
                    <td>
                      {e.respondedAt
                        ? new Date(e.respondedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td>{e.respondedByDisplayName ?? '—'}</td>
                    <td className={styles.customDivider}>
                      {answers.length === 0 ? (
                        '—'
                      ) : (
                        <div className={styles.customCell}>
                          {answers.map((a) => (
                            <span key={a.label}>
                              <span className={styles.customLabel}>
                                {a.label}:
                              </span>
                              {a.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </>
      )}
    </Modal>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/admin/routes/GuestDetailModal.tsx
git commit -m "Restructure GuestDetailModal around custom-field divider rule"
```

---

## Phase 7 — Log tab

### Task 26: Add `Log.tsx` page

**Files:**
- Create: `packages/rsvp/src/admin/routes/Log.tsx`
- Create: `packages/rsvp/src/admin/routes/Log.module.css`

- [ ] **Step 1: Implement the page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import {
  listGuestResponseLog,
  listRsvpResponseLog,
  type AdminGuestResponseLogRow,
  type AdminRsvpResponseLogRow,
} from '../../server/admin/responses'
import {
  formatCustomAnswers,
  renderCustomFieldValue,
} from '../lib/customFieldRender'
import guestListStyles from './GuestList.module.css'
import styles from './Log.module.css'
import type { CustomFieldConfig } from '../../schema'

export function Log() {
  const [rsvpRows, setRsvpRows] = useState<AdminRsvpResponseLogRow[]>([])
  const [guestRows, setGuestRows] = useState<AdminGuestResponseLogRow[]>([])
  const [guestCustomFields, setGuestCustomFields] = useState<
    CustomFieldConfig[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [r, g] = await Promise.all([
          listRsvpResponseLog(),
          listGuestResponseLog(),
        ])
        setRsvpRows(r.rows)
        setGuestRows(g.rows)
        setGuestCustomFields(g.guestCustomFields)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <LoadingIndicator />
  if (error) return <ErrorMessage>{error}</ErrorMessage>

  return (
    <div className={styles.page}>
      <PageHeader title="RSVP responses" />
      <Table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Guest</th>
            <th>Event</th>
            <th>Status</th>
            <th>Responded by</th>
            <th className={guestListStyles.customDivider}>Custom answers</th>
          </tr>
        </thead>
        <tbody>
          {rsvpRows.length === 0 && (
            <tr>
              <td colSpan={6} className={guestListStyles.muted}>
                No RSVP responses yet.
              </td>
            </tr>
          )}
          {rsvpRows.map((row) => {
            const answers = formatCustomAnswers(
              row.eventCustomFields,
              row.notesJson
            )
            return (
              <tr key={row.id}>
                <td>{new Date(row.respondedAt).toLocaleString()}</td>
                <td>{row.guestName}</td>
                <td>{row.eventName}</td>
                <td>{row.status}</td>
                <td>{row.respondedByDisplayName ?? '—'}</td>
                <td className={guestListStyles.customDivider}>
                  {answers.length === 0 ? (
                    '—'
                  ) : (
                    <div className={guestListStyles.customCell}>
                      {answers.map((a) => (
                        <span key={a.label}>
                          <span className={guestListStyles.customLabel}>
                            {a.label}:
                          </span>
                          {a.value}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>

      <PageHeader title="Guest responses" />
      <Table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Guest</th>
            <th>Notes</th>
            <th>Responded by</th>
            {guestCustomFields.map((f, i) => (
              <th
                key={f.id}
                className={
                  i === 0 ? guestListStyles.customDivider : undefined
                }
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guestRows.length === 0 && (
            <tr>
              <td
                colSpan={4 + guestCustomFields.length}
                className={guestListStyles.muted}
              >
                No guest responses yet.
              </td>
            </tr>
          )}
          {guestRows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.respondedAt).toLocaleString()}</td>
              <td>{row.guestName}</td>
              <td>{row.notes ?? '—'}</td>
              <td>{row.respondedByDisplayName ?? '—'}</td>
              {guestCustomFields.map((f, i) => (
                <td
                  key={f.id}
                  className={
                    i === 0 ? guestListStyles.customDivider : undefined
                  }
                >
                  {renderCustomFieldValue(f, row.notesJson) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Add minimal styles**

Create `packages/rsvp/src/admin/routes/Log.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/admin/routes/Log.tsx packages/rsvp/src/admin/routes/Log.module.css
git commit -m "Add Log page rendering both response tables"
```

---

### Task 27: Add Log entry-file and `AdminShell` nav

**Files:**
- Create: `packages/rsvp/src/admin/log.tsx`
- Modify: `packages/rsvp/src/admin/AdminShell.tsx`
- Modify: `packages/rsvp/src/admin/index.tsx`
- Modify: `packages/rsvp/src/admin/events.tsx`

- [ ] **Step 1: Add the entry**

Create `packages/rsvp/src/admin/log.tsx`:

```tsx
import { AdminShell } from './AdminShell'
import { Log } from './routes/Log'

export default function AdminLog() {
  return (
    <AdminShell title="Log · Wedding Admin" current="log">
      <Log />
    </AdminShell>
  )
}
```

- [ ] **Step 2: Update `AdminShell`**

Open `packages/rsvp/src/admin/AdminShell.tsx`. Widen the `current` union and add the nav link:

```tsx
interface AdminShellProps {
  title: string
  current?: 'guests' | 'events' | 'log'
  children: ReactNode
}

// In the JSX, after the Events nav link:
<a href="/admin/log/" className={navLinkClass('log')}>
  Log
</a>
```

And update `navLinkClass`:

```tsx
const navLinkClass = (name: 'guests' | 'events' | 'log') =>
  `${styles.navLink} ${current === name ? styles.navLinkActive : ''}`
```

- [ ] **Step 3: Sanity check the existing `index.tsx` and `events.tsx`**

No changes needed; `current="guests"` and `current="events"` continue to work since the union now includes them.

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/admin/log.tsx packages/rsvp/src/admin/AdminShell.tsx
git commit -m "Add Log nav entry and admin entry file"
```

---

### Task 28: Wire `/admin/log/` into Vite

**Files:**
- Modify: `packages/rsvp/vite.config.ts`

- [ ] **Step 1: Add the route**

In the `rscStaticPages` plugin call, extend the `pages` map:

```ts
rscStaticPages({
  pages: {
    '/': './src/admin/index.tsx',
    '/events/': './src/admin/events.tsx',
    '/import/': './src/admin/import.tsx',
    '/log/': './src/admin/log.tsx',
  },
}),
```

- [ ] **Step 2: Build the rsvp package to verify routing emits**

```bash
pnpm --filter rsvp build
```

Expected: build succeeds; no missing-input errors.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/vite.config.ts
git commit -m "Wire /admin/log/ into rscStaticPages"
```

---

## Phase 8 — CSV adjustment + smoke

### Task 29: Update `rsvpCsv.ts` for the new shape

**Files:**
- Modify: `packages/rsvp/src/admin/lib/rsvpCsv.ts`

- [ ] **Step 1: Replace the file**

```ts
import type { AdminResponseRow } from '../../schema'

const HEADER = [
  'groupLabel',
  'inviteCode',
  'guestName',
  'eventName',
  'status',
  'customAnswers',
  'notes',
  'respondedAt',
] as const

function escapeCsv(v: string | null): string {
  return v === null ? '' : `"${v.replace(/"/g, '""')}"`
}

export function responsesToCsv(rows: AdminResponseRow[]): string {
  return [
    HEADER.join(','),
    ...rows.map((r) =>
      [
        r.groupLabel,
        r.inviteCode,
        r.guestName,
        r.eventName,
        r.status,
        r.customAnswers,
        r.notes,
        r.respondedAt,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter rsvp typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/admin/lib/rsvpCsv.ts
git commit -m "Update CSV export columns for unified custom-answers"
```

---

### Task 30: Smoke run

**Files:** none (manual run + verification)

- [ ] **Step 1: Wipe and re-migrate local D1**

```bash
pnpm clean && pnpm --filter rsvp db:migrate:local
```

- [ ] **Step 2: Start dev**

```bash
pnpm dev
```

Wait for both workers to be up (frontend on `:5174`, rsvp/admin on `:5173`).

- [ ] **Step 3: Walk through admin setup**

In a browser at `http://localhost:5173/admin/`:
- Verify the nav reads `Guests | Events | Log`.
- Visit `/admin/events/`. Confirm the "Guest profile fields" section shows the seeded `Dietary restrictions or allergies` and `Song request` fields.
- Create an event named "Reception" with one custom field `meal_choice` (single_select, options "Chicken", "Fish", "Vegetarian").
- Create a guest group with two guests. Note the leader's invite code.

- [ ] **Step 4: Walk through public RSVP**

Open `http://localhost:5174/rsvp?code=<INVITE_CODE>`:
- Mark both guests "Attending" for Reception.
- Pick a different meal for each.
- Fill in dietary for both. Fill in song request and a long-text "anything else?" note.
- Submit. Re-load the page; confirm the answers are pre-populated.

- [ ] **Step 5: Verify the Log tab**

Visit `http://localhost:5173/admin/log/`:
- Two rows in "RSVP responses" (one per guest), one row in "Guest responses" per guest.
- Re-submit the public form unchanged → no new rows in either table.
- Change one meal choice → one new row in "RSVP responses".

- [ ] **Step 6: Verify divider styling**

Visually confirm that custom columns sit to the right of core columns with the left-border divider in:
- Guests page outer table.
- Guest detail modal (header detail-grid, events table).
- Log tables.

- [ ] **Step 7: Commit a doc note (optional)**

If you encounter any visual tweaks needed, note them in a follow-up commit; otherwise nothing to commit here.

---

## Final self-checks

- [ ] **`pnpm typecheck` from the repo root** — passes.
- [ ] **`pnpm vitest run` from the repo root** — passes.
- [ ] **`pnpm lint` from the repo root** — passes.
- [ ] **`pnpm format:check` from the repo root** — passes (run `pnpm format` if not).

```bash
pnpm typecheck && pnpm vitest run && pnpm lint && pnpm format:check
```

If all green, the branch is ready for review.
