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
