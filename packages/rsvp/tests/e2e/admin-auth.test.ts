import {
  createServer,
  isRunnableDevEnvironment,
  type ViteDevServer,
} from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

let server: ViteDevServer
let handleAdminRsc: typeof import('../../src/server/admin/rsc-entry').handleAdminRsc
let adminActionId: string
let publicActionId: string

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc
  if (!isRunnableDevEnvironment(env)) {
    throw new Error('rsc environment is not runnable')
  }
  return (await env.runner.import(id)) as T
}

function extractActionId(fn: unknown): string {
  if (typeof fn !== 'function') throw new Error('not a function')
  const id = (fn as { $$id?: unknown }).$$id
  if (typeof id !== 'string' || !id.includes('#')) {
    throw new Error(`server function missing $$id; got ${String(id)}`)
  }
  return id
}

beforeAll(async () => {
  // Use a high random port to avoid clashes with a dev server.
  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await createServer({
    configFile: './vite.config.node.ts',
    server: { port, strictPort: false, host: '127.0.0.1' },
    appType: 'custom',
  })
  await server.listen()

  // Load the admin RSC entry handler via the RSC env runner.
  const adminEntry =
    await loadRscModule<typeof import('../../src/server/admin/rsc-entry')>(
      '/src/server/admin/rsc-entry.ts'
    )
  handleAdminRsc = adminEntry.handleAdminRsc

  // Derive real action ids from the same RSC-env module graph so the handler's
  // allowlist sees them.
  const adminMod = await loadRscModule<
    typeof import('../../src/server/admin/events')
  >('/src/server/admin/events.ts')
  adminActionId = extractActionId(adminMod.listEvents)
  const publicMod = await loadRscModule<
    typeof import('../../src/server/public/rsvp')
  >('/src/server/public/rsvp.ts')
  publicActionId = extractActionId(publicMod.lookupGuests)
}, 60_000)

afterAll(async () => {
  await server?.close()
})

test('admin action with non-localhost triggers auth (returns 401 when denied)', async () => {
  const res = await handleAdminRsc(
    new Request(
      `http://example.com/@rsc-admin/${encodeURIComponent(adminActionId)}`,
      { method: 'POST' }
    ),
    { aud: 'test-aud', teamDomain: 'test-team' }
  )
  expect(res.status).toBe(401)
})

test('admin action with localhost bypasses auth', async () => {
  // localhost bypass means auth is skipped; request will proceed to
  // decodeReply which may fail on missing body — but NOT with 401.
  let status: number | null = null
  try {
    const res = await handleAdminRsc(
      new Request(
        `http://localhost/@rsc-admin/${encodeURIComponent(adminActionId)}`,
        { method: 'POST' }
      ),
      { aud: 'test-aud', teamDomain: 'test-team' }
    )
    status = res.status
  } catch {
    // decodeReply rejected on empty body — not an auth failure.
    status = null
  }
  expect(status).not.toBe(401)
})

test('public action id rejected on admin handler', async () => {
  const res = await handleAdminRsc(
    new Request(
      `http://localhost/@rsc-admin/${encodeURIComponent(publicActionId)}`,
      { method: 'POST' }
    ),
    { aud: '', teamDomain: '' }
  )
  expect(res.status).toBe(403)
})
