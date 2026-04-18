-- Initial schema (consolidated). Single migration representing the launch
-- state of the database. Pre-deployment, so the prior step-by-step
-- migrations have been squashed into this file.

-- ── Guests ──────────────────────────────────────────────────────────────
-- A guest is either a party leader (party_leader_id IS NULL) or a member
-- of a party (party_leader_id references the leader's row). The leader's
-- `group_label` is the party label shown in the admin UI; member rows
-- mirror it for denormalized reads. `invite_code` is unique per guest —
-- any code resolves to its party's full RSVP form, so sharing remains
-- per-person while RSVPing stays group-wide.
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
  dietary_restrictions TEXT,
  notes TEXT,
  notes_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_guest_party_leader ON guest(party_leader_id);
CREATE INDEX idx_guest_invite_code ON guest(invite_code);
CREATE INDEX idx_guest_email ON guest(email);
CREATE INDEX idx_guest_display_name ON guest(display_name);

-- ── Events ──────────────────────────────────────────────────────────────
-- Weekend events (ceremony, reception, brunch, etc). `requires_meal_choice`
-- drives whether the RSVP form shows a meal picker for attending guests.
CREATE TABLE event (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  starts_at TEXT,
  ends_at TEXT,
  location_name TEXT,
  address TEXT,
  rsvp_deadline TEXT,
  requires_meal_choice INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Invitations ─────────────────────────────────────────────────────────
-- An invitation links a party (by its leader guest_id) to an event. One
-- row covers the whole party — individual member RSVPs live in the rsvp
-- table.
CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  UNIQUE (guest_id, event_id)
);

CREATE INDEX idx_invitation_guest ON invitation(guest_id);
CREATE INDEX idx_invitation_event ON invitation(event_id);

-- ── Meal options ────────────────────────────────────────────────────────
-- Per-event meal choices. Admin maintains the list; RSVPs reference a
-- specific meal_option by id via rsvp.meal_choice_id.
CREATE TABLE meal_option (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT
);

CREATE INDEX idx_meal_option_event ON meal_option(event_id);

-- ── RSVPs ───────────────────────────────────────────────────────────────
-- One row per (guest, event) once that guest has been responded for.
-- Submissions happen on behalf of the whole party from any member's
-- invite code; responded_by_guest_id records who submitted the change.
CREATE TABLE rsvp (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attending', 'declined')),
  meal_choice_id TEXT REFERENCES meal_option(id) ON DELETE SET NULL,
  responded_at TEXT,
  responded_by_guest_id TEXT REFERENCES guest(id) ON DELETE SET NULL,
  UNIQUE (guest_id, event_id)
);

CREATE INDEX idx_rsvp_guest ON rsvp(guest_id);
CREATE INDEX idx_rsvp_event ON rsvp(event_id);

-- ── Seed events ─────────────────────────────────────────────────────────
-- Placeholder rows for the two default events. Edit via the admin UI.
INSERT INTO event (id, name, slug, starts_at, location_name, requires_meal_choice, sort_order)
VALUES
  ('evt_ceremony', 'Ceremony', 'ceremony', '2026-09-19T16:00:00-04:00', 'Hartland, Vermont', 0, 10),
  ('evt_reception', 'Reception', 'reception', '2026-09-19T18:00:00-04:00', 'Hartland, Vermont', 1, 20);
