-- Guest groups (households / parties traveling together)
CREATE TABLE guest_group (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  primary_contact_guest_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_guest_group_invite_code ON guest_group (invite_code);

-- Individual guests
CREATE TABLE guest (
  id TEXT PRIMARY KEY,
  guest_group_id TEXT NOT NULL REFERENCES guest_group(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  age_group TEXT NOT NULL DEFAULT 'adult' CHECK (age_group IN ('adult', 'child', 'infant')),
  is_plus_one INTEGER NOT NULL DEFAULT 0,
  dietary_restrictions TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_guest_group_id ON guest (guest_group_id);
CREATE INDEX idx_guest_email ON guest (email);
CREATE INDEX idx_guest_display_name ON guest (display_name);

-- Wedding events (ceremony, reception, rehearsal dinner, brunch, etc.)
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

-- Per-group invitation to a specific event
CREATE TABLE invitation (
  id TEXT PRIMARY KEY,
  guest_group_id TEXT NOT NULL REFERENCES guest_group(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  UNIQUE (guest_group_id, event_id)
);

CREATE INDEX idx_invitation_group ON invitation (guest_group_id);
CREATE INDEX idx_invitation_event ON invitation (event_id);

-- Optional subset of guests within a group invited to an event.
-- If no rows exist for an invitation_id, all group members are invited.
CREATE TABLE invitation_guest (
  invitation_id TEXT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  PRIMARY KEY (invitation_id, guest_id)
);

-- Meal options per event
CREATE TABLE meal_option (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  is_child_meal INTEGER NOT NULL DEFAULT 0,
  is_vegetarian INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_meal_option_event ON meal_option (event_id);

-- Per-guest-per-event RSVP
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

CREATE INDEX idx_rsvp_guest ON rsvp (guest_id);
CREATE INDEX idx_rsvp_event ON rsvp (event_id);

-- Optional song requests submitted as part of the RSVP form
CREATE TABLE song_request (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_song_request_guest ON song_request (guest_id);
