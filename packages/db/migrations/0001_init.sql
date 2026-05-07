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
CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  UNIQUE (guest_id, event_id)
);
CREATE INDEX idx_invitation_guest ON invitation(guest_id);
CREATE INDEX idx_invitation_event ON invitation(event_id);

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

-- One row per guest per public submit, when something changed.
-- The `notes` column is the hardcoded long-text "anything else?" field
-- on the public form; `notes_json` holds answers for the hardcoded
-- guest-profile schema. Asymmetric vs. rsvp_response (which has no
-- `notes`) because there's no equivalent free-text field in the
-- per-event RSVP UI.
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
