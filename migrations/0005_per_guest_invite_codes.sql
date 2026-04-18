-- Move invite codes from guest groups to individual guests. Each guest gets
-- their own unique code; the code still resolves to the guest's full group
-- RSVP experience, but now each person can be tracked and linked separately.

-- 1. Add the per-guest column and populate it.
ALTER TABLE guest ADD COLUMN invite_code TEXT;

-- Populate existing rows with unique hex codes. At wedding scale the
-- collision space for 4 random bytes is effectively 0; if any existing
-- dataset ever DID collide, the CREATE UNIQUE INDEX below would fail loudly.
UPDATE guest SET invite_code = lower(hex(randomblob(4))) WHERE invite_code IS NULL;

CREATE UNIQUE INDEX idx_guest_invite_code ON guest(invite_code);

-- 2. Rebuild guest_group without invite_code. SQLite can't DROP a UNIQUE
-- column in place, so we copy the data into a fresh table and swap names.
-- D1 runs with foreign_keys OFF by default, so dropping/renaming the table
-- with outgoing FKs (invitation, guest) is safe here.

DROP INDEX IF EXISTS idx_guest_group_invite_code;

CREATE TABLE guest_group_new (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  primary_contact_guest_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO guest_group_new (id, label, primary_contact_guest_id, notes, created_at, updated_at)
SELECT id, label, primary_contact_guest_id, notes, created_at, updated_at FROM guest_group;

DROP TABLE guest_group;
ALTER TABLE guest_group_new RENAME TO guest_group;
