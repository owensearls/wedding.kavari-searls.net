-- Flatten guest_group into guest self-referencing. Drop invitation_guest and
-- song_request tables. Song request data migrates into guest.notes_json.

-- 1. Create the new guest table with self-referencing party_leader_id.
CREATE TABLE guest_new (
  id TEXT PRIMARY KEY,
  party_leader_id TEXT REFERENCES guest_new(id) ON DELETE CASCADE,
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

-- 2. Identify leaders: if guest_group.primary_contact_guest_id is set and that
--    guest exists, use that guest as leader; otherwise pick the guest with the
--    lowest rowid in each group.

-- Insert leaders first (party_leader_id = NULL).
-- A leader is: the primary_contact_guest_id if set, else the min-rowid guest.
INSERT INTO guest_new (
  id, party_leader_id, first_name, last_name, display_name,
  email, phone, invite_code, group_label,
  dietary_restrictions, notes, notes_json, created_at, updated_at
)
SELECT
  g.id, NULL, g.first_name, g.last_name, g.display_name,
  g.email, g.phone, g.invite_code, gg.label,
  g.dietary_restrictions, g.notes, NULL, g.created_at, g.updated_at
FROM guest g
JOIN guest_group gg ON gg.id = g.guest_group_id
WHERE g.id = COALESCE(
  (SELECT pc.id FROM guest pc WHERE pc.id = gg.primary_contact_guest_id AND pc.guest_group_id = gg.id),
  (SELECT m.id FROM guest m WHERE m.guest_group_id = gg.id ORDER BY m.rowid LIMIT 1)
);

-- 3. Insert non-leader members with party_leader_id pointing to leader.
INSERT INTO guest_new (
  id, party_leader_id, first_name, last_name, display_name,
  email, phone, invite_code, group_label,
  dietary_restrictions, notes, notes_json, created_at, updated_at
)
SELECT
  g.id,
  COALESCE(
    (SELECT pc.id FROM guest pc WHERE pc.id = gg.primary_contact_guest_id AND pc.guest_group_id = gg.id),
    (SELECT m.id FROM guest m WHERE m.guest_group_id = gg.id ORDER BY m.rowid LIMIT 1)
  ),
  g.first_name, g.last_name, g.display_name,
  g.email, g.phone, g.invite_code, gg.label,
  g.dietary_restrictions, g.notes, NULL, g.created_at, g.updated_at
FROM guest g
JOIN guest_group gg ON gg.id = g.guest_group_id
WHERE g.id NOT IN (SELECT id FROM guest_new);

-- 4. Migrate song_request data into notes_json. For guests with song requests,
--    we take the first song request (by rowid) and store it as JSON.
UPDATE guest_new SET notes_json = (
  SELECT '{"songRequest":{"title":' ||
    json_quote(sr.title) ||
    CASE WHEN sr.artist IS NOT NULL THEN ',"artist":' || json_quote(sr.artist) ELSE '' END ||
    '}}'
  FROM song_request sr
  WHERE sr.guest_id = guest_new.id
  ORDER BY sr.rowid
  LIMIT 1
)
WHERE EXISTS (SELECT 1 FROM song_request sr WHERE sr.guest_id = guest_new.id);

-- 5. Create the new invitation table referencing party leader guest_id.
CREATE TABLE invitation_new (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guest_new(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  UNIQUE (guest_id, event_id)
);

INSERT INTO invitation_new (id, guest_id, event_id)
SELECT
  inv.id,
  COALESCE(
    (SELECT pc.id FROM guest pc WHERE pc.id = gg.primary_contact_guest_id AND pc.guest_group_id = gg.id),
    (SELECT m.id FROM guest m WHERE m.guest_group_id = gg.id ORDER BY m.rowid LIMIT 1)
  ),
  inv.event_id
FROM invitation inv
JOIN guest_group gg ON gg.id = inv.guest_group_id;

-- 6. Drop old tables.
DROP TABLE IF EXISTS invitation_guest;
DROP TABLE IF EXISTS song_request;
DROP TABLE IF EXISTS invitation;
DROP TABLE IF EXISTS guest;
DROP TABLE IF EXISTS guest_group;

-- 7. Rename new tables.
ALTER TABLE guest_new RENAME TO guest;
ALTER TABLE invitation_new RENAME TO invitation;

-- 8. Recreate indexes.
CREATE INDEX idx_guest_party_leader ON guest(party_leader_id);
CREATE INDEX idx_guest_invite_code ON guest(invite_code);
CREATE INDEX idx_guest_email ON guest(email);
CREATE INDEX idx_guest_display_name ON guest(display_name);
CREATE INDEX idx_invitation_guest ON invitation(guest_id);
CREATE INDEX idx_invitation_event ON invitation(event_id);
