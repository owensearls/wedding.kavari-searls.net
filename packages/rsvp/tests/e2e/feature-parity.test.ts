import { readdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import {
  createServer,
  isRunnableDevEnvironment,
  type ViteDevServer,
} from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { Database as DbSchema } from '../../src/server/shared/lib/schema'

// End-to-end feature-parity test for the RSC server functions. Each CRUD path
// used by the public RSVP flow and the admin UI is exercised against a real
// local D1 sqlite file via Kysely. Functions are invoked directly inside
// runWithEnv (not over HTTP) — the RPC transport layer is covered separately
// by rpc.roundtrip.test.ts. The focus here is that every server function
// we ship boots, talks to the DB, and returns a well-shaped result.

let server: ViteDevServer
let sqliteDb: Database.Database
let kyselyDb: Kysely<DbSchema>
let runWithEnv: typeof import('../../src/server/shared/context').runWithEnv

// Modules (loaded via RSC env runner so "use server" + $$id work).
let rsvpMod: typeof import('../../src/server/public/rsvp')
let eventsMod: typeof import('../../src/server/admin/events')
let groupsMod: typeof import('../../src/server/admin/groups')
let guestsMod: typeof import('../../src/server/admin/guests')
let importMod: typeof import('../../src/server/admin/import')
let responsesMod: typeof import('../../src/server/admin/responses')

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH
  const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  const entries = readdirSync(dir)
  const match = entries.find(
    (e) => e.endsWith('.sqlite') && e !== 'metadata.sqlite'
  )
  if (!match) {
    throw new Error('no local D1 sqlite file; run pnpm db:migrate:local')
  }
  return `${dir}/${match}`
}

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc
  if (!isRunnableDevEnvironment(env)) {
    throw new Error('rsc environment is not runnable')
  }
  return (await env.runner.import(id)) as T
}

// Convenience: run `fn` with the shared Kysely env visible to getEnv().
async function withEnv<T>(fn: () => Promise<T>): Promise<T> {
  return runWithEnv({ DB: kyselyDb }, fn)
}

// Unique per-run prefix so repeated runs of this test don't collide with
// each other or with seeded rows.
const RUN_PREFIX = `fp${Date.now().toString(36)}`

// Track ids created in this run so the afterAll hook can delete them.
const created: {
  eventIds: string[]
  groupIds: string[]
} = { eventIds: [], groupIds: [] }

beforeAll(async () => {
  sqliteDb = new Database(resolveSqlitePath())
  kyselyDb = new Kysely<DbSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  })

  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await createServer({
    configFile: './vite.config.node.ts',
    server: { port, strictPort: false, host: '127.0.0.1' },
    appType: 'custom',
  })
  await server.listen()

  // IMPORTANT: load runWithEnv through the RSC env runner so the server
  // functions — also loaded through the runner — share the same ALS instance.
  const ctx = await loadRscModule<typeof import('../../src/server/shared/context')>(
    '/src/server/shared/context.ts'
  )
  runWithEnv = ctx.runWithEnv

  rsvpMod = await loadRscModule('/src/server/public/rsvp.ts')
  eventsMod = await loadRscModule('/src/server/admin/events.ts')
  groupsMod = await loadRscModule('/src/server/admin/groups.ts')
  guestsMod = await loadRscModule('/src/server/admin/guests.ts')
  importMod = await loadRscModule('/src/server/admin/import.ts')
  responsesMod = await loadRscModule('/src/server/admin/responses.ts')
}, 60_000)

afterAll(async () => {
  // Best-effort cleanup of anything created in this run.
  try {
    for (const gid of created.groupIds) {
      await withEnv(async () => {
        try {
          await groupsMod.deleteGroup(gid)
        } catch {
          /* ignore */
        }
      })
    }
    if (created.eventIds.length) {
      await withEnv(async () => {
        await kyselyDb
          .deleteFrom('event')
          .where('id', 'in', created.eventIds)
          .execute()
      })
    }
    // Import rows live under a unique groupLabel; remove any leader we created
    // via importRows whose label starts with our RUN_PREFIX.
    await withEnv(async () => {
      await kyselyDb
        .deleteFrom('guest')
        .where('group_label', 'like', `${RUN_PREFIX}-%`)
        .execute()
    })
  } finally {
    await server?.close()
    sqliteDb?.close()
  }
})

test('public: lookupGuests returns a matches array', async () => {
  const res = await withEnv(() => rsvpMod.lookupGuests('kavari'))
  expect(res).toHaveProperty('matches')
  expect(Array.isArray(res.matches)).toBe(true)
})

test('admin: listEvents returns shape { events: [...] }', async () => {
  const res = await withEnv(() => eventsMod.listEvents())
  expect(res).toHaveProperty('events')
  expect(Array.isArray(res.events)).toBe(true)
})

test('admin: saveEvent (create) inserts a new event', async () => {
  const slug = `${RUN_PREFIX}-evt`
  const res = await withEnv(() =>
    eventsMod.saveEvent({
      name: `${RUN_PREFIX} event`,
      slug,
      requiresMealChoice: false,
      sortOrder: 999,
      mealOptions: [],
    })
  )
  expect(res.id).toBeTruthy()
  created.eventIds.push(res.id)

  const list = await withEnv(() => eventsMod.listEvents())
  const found = list.events.find((e) => e.id === res.id)
  expect(found).toBeDefined()
  expect(found?.slug).toBe(slug)
})

test('admin: saveEvent (update) persists changes for an existing id', async () => {
  const id = created.eventIds[0]
  expect(id, 'create-event must have run first').toBeTruthy()

  const newName = `${RUN_PREFIX} event updated`
  const res = await withEnv(() =>
    eventsMod.saveEvent({
      id,
      name: newName,
      slug: `${RUN_PREFIX}-evt`,
      requiresMealChoice: false,
      sortOrder: 999,
      mealOptions: [],
    })
  )
  expect(res.id).toBe(id)

  const list = await withEnv(() => eventsMod.listEvents())
  const found = list.events.find((e) => e.id === id)
  expect(found?.name).toBe(newName)
})

test('admin: listGroups returns shape { groups: [...] }', async () => {
  const res = await withEnv(() => groupsMod.listGroups())
  expect(res).toHaveProperty('groups')
  expect(Array.isArray(res.groups)).toBe(true)
})

test('admin: saveGroup (create) inserts a new group with members', async () => {
  const label = `${RUN_PREFIX} group`
  const res = await withEnv(() =>
    groupsMod.saveGroup({
      label,
      notes: null,
      invitedEventIds: [],
      guests: [
        {
          firstName: 'Test',
          lastName: 'Person',
          email: null,
          phone: null,
          dietaryRestrictions: null,
          notes: null,
        },
        {
          firstName: 'Partner',
          lastName: 'Person',
          email: null,
          phone: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    })
  )
  expect(res.id).toBeTruthy()
  created.groupIds.push(res.id)

  const list = await withEnv(() => groupsMod.listGroups())
  const found = list.groups.find((g) => g.id === res.id)
  expect(found).toBeDefined()
  expect(found?.label).toBe(label)
  expect(found?.guestCount).toBe(2)
})

test('admin: getGroup(id) returns guests + invitedEventIds', async () => {
  const id = created.groupIds[0]
  expect(id).toBeTruthy()

  const res = await withEnv(() => groupsMod.getGroup(id))
  expect(res.id).toBe(id)
  expect(Array.isArray(res.guests)).toBe(true)
  expect(res.guests.length).toBeGreaterThanOrEqual(2)
  expect(Array.isArray(res.invitedEventIds)).toBe(true)
})

test('admin: getGuest(id) returns guest detail shape', async () => {
  const groupId = created.groupIds[0]
  expect(groupId).toBeTruthy()

  const group = await withEnv(() => groupsMod.getGroup(groupId))
  const leader = group.guests[0]
  expect(leader.id).toBeTruthy()

  const res = await withEnv(() => guestsMod.getGuest(leader.id!))
  expect(res.id).toBe(leader.id)
  expect(res).toHaveProperty('displayName')
  expect(res).toHaveProperty('inviteCode')
  expect(Array.isArray(res.events)).toBe(true)
})

test('admin: importRows creates a new group from CSV-like rows', async () => {
  const label = `${RUN_PREFIX}-imp`
  const res = await withEnv(() =>
    importMod.importRows([
      {
        groupLabel: label,
        firstName: 'Imp',
        lastName: 'Orted',
        email: 'i@o.com',
      },
    ])
  )
  expect(Array.isArray(res.created)).toBe(true)
  expect(Array.isArray(res.skipped)).toBe(true)
  expect(res.created.length + res.skipped.length).toBeGreaterThanOrEqual(1)

  // If we created (not skipped), track the group id for cleanup.
  const newlyCreated = res.created.find((g) => g.label === label)
  if (newlyCreated) {
    // importRows groups have deterministic group ids — make sure cleanup
    // removes them via the label filter in afterAll.
    expect(newlyCreated.guests.length).toBe(1)
  }
})

test('admin: listResponses returns { rows: [...] }', async () => {
  const res = await withEnv(() => responsesMod.listResponses())
  expect(res).toHaveProperty('rows')
  expect(Array.isArray(res.rows)).toBe(true)
})

test('public: end-to-end lookup -> submitRsvp -> getRsvpGroup round-trip', async () => {
  // Seed an admin group with invitations to the two seed events so an RSVP
  // submission has something to bind to.
  const seedSlugs = ['ceremony', 'reception']
  const events = await withEnv(async () => {
    return kyselyDb
      .selectFrom('event')
      .select(['id', 'slug'])
      .where('slug', 'in', seedSlugs)
      .execute()
  })
  const invitedEventIds = events.map((e) => e.id)
  expect(invitedEventIds.length).toBe(2)

  const label = `${RUN_PREFIX} rsvp-group`
  const saved = await withEnv(() =>
    groupsMod.saveGroup({
      label,
      notes: null,
      invitedEventIds,
      guests: [
        {
          firstName: 'Rsvp',
          lastName: 'Tester',
          email: null,
          phone: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    })
  )
  created.groupIds.push(saved.id)

  const group = await withEnv(() => groupsMod.getGroup(saved.id))
  const leader = group.guests[0]
  const inviteCode = leader.inviteCode!
  expect(inviteCode).toBeTruthy()

  // lookupGuests by last name should find this group.
  const lookup = await withEnv(() => rsvpMod.lookupGuests('Tester'))
  const match = lookup.matches.find((m) => m.inviteCode === inviteCode)
  expect(
    match,
    'lookup should include our freshly-created invite'
  ).toBeDefined()

  // submitRsvp: mark "attending" on the ceremony (no meal choice needed).
  const ceremonyId = events.find((e) => e.slug === 'ceremony')!.id
  const submitRes = await withEnv(() =>
    rsvpMod.submitRsvp(inviteCode, {
      respondedByGuestId: leader.id!,
      rsvps: [
        { guestId: leader.id!, eventId: ceremonyId, status: 'attending' },
      ],
      guestUpdates: [],
    })
  )
  expect(submitRes.ok).toBe(true)
  expect(submitRes.respondedAt).toBeTruthy()

  // getRsvpGroup should reflect the saved RSVP.
  const readBack = await withEnv(() => rsvpMod.getRsvpGroup(inviteCode))
  const ceremonyRow = readBack.rsvps.find((r) => r.eventId === ceremonyId)
  expect(ceremonyRow?.status).toBe('attending')
})

test('admin: deleteGroup(id) removes the group', async () => {
  // Create a throwaway group just for this test so deletion doesn't wipe
  // state an earlier test depends on.
  const label = `${RUN_PREFIX} throwaway`
  const { id } = await withEnv(() =>
    groupsMod.saveGroup({
      label,
      notes: null,
      invitedEventIds: [],
      guests: [
        {
          firstName: 'Delete',
          lastName: 'Me',
          email: null,
          phone: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    })
  )

  const res = await withEnv(() => groupsMod.deleteGroup(id))
  expect(res.ok).toBe(true)

  await expect(withEnv(() => groupsMod.getGroup(id))).rejects.toThrow(
    /Not found/
  )
})
