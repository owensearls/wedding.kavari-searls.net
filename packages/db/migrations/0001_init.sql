-- Initial schema (consolidated). Pre-launch single migration.

-- ── Admin settings (singleton row, id = 'default') ──────────────────────
CREATE TABLE admin_settings (
  id TEXT PRIMARY KEY,
  default_invitation_notes_schema TEXT,
  lookup_by_name_enabled INTEGER NOT NULL DEFAULT 1
);

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
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes_schema TEXT
);

-- ── Invitations ─────────────────────────────────────────────────────────
-- `notes_schema` defines invite-level questions (the same JSON Schema
-- shape used by event.notes_schema). It is logically a per-invite value
-- (one schema per party leader), but is stored on every (leader, event)
-- row for simplicity; saveGroup keeps them in sync.
CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  notes_schema TEXT,
  UNIQUE (guest_id, event_id)
);
CREATE INDEX idx_invitation_guest ON invitation(guest_id);
CREATE INDEX idx_invitation_event ON invitation(event_id);

-- ── Append-only response tables ─────────────────────────────────────────
-- A guest_response captures the full state submitted for one guest at
-- one moment: their invite-level notes plus a set of per-event responses
-- (stored as child guest_invitation_response rows). One submit can write
-- multiple guest_responses (one per guest whose state changed); per-guest
-- state is rewritten in full each time it changes.
CREATE TABLE guest_response (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  notes_json TEXT,
  responded_at TEXT NOT NULL,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL
);
CREATE INDEX idx_guest_response_guest_at
  ON guest_response(guest_id, responded_at);

CREATE TABLE guest_invitation_response (
  id TEXT PRIMARY KEY,
  guest_response_id TEXT NOT NULL REFERENCES guest_response(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'declined')),
  notes_json TEXT,
  UNIQUE (guest_response_id, event_id)
);
CREATE INDEX idx_guest_invitation_response_response
  ON guest_invitation_response(guest_response_id);
CREATE INDEX idx_guest_invitation_response_event
  ON guest_invitation_response(event_id);
