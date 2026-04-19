import {
  createServer,
  isRunnableDevEnvironment,
  type ViteDevServer,
} from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

let server: ViteDevServer
let createRscHandler: typeof import('../../src/entry.rsc.ts').createRscHandler
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

  // Load entry.rsc via the RSC env runner because
  // @vitejs/plugin-rsc/rsc imports virtual modules that only resolve
  // under Vite, not plain Node's ESM loader.
  const entry =
    await loadRscModule<typeof import('../../src/entry.rsc.ts')>(
      '/src/entry.rsc.ts'
    )
  createRscHandler = entry.createRscHandler

  // Derive real action ids from the same RSC-env module graph so the handler's
  // allowlist sees them. Ids are path-based in dev / hashed in prod; the tests
  // stay agnostic to format.
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

test('admin action id triggers authorize callback (returns 401 when denied)', async () => {
  const handler = createRscHandler(
    async () => new Response('Unauthorized', { status: 401 })
  )
  const res = await handler(
    new Request(`http://x/@rsc/${encodeURIComponent(adminActionId)}`, {
      method: 'POST',
    })
  )
  expect(res.status).toBe(401)
})

test('public action id does not trigger authorize callback', async () => {
  const handler = createRscHandler(
    async () => new Response('Unauthorized', { status: 401 })
  )
  // The authorize callback must be skipped for public ids. The request has no
  // body, so `decodeReply` will either return a non-401 Response or throw —
  // both outcomes prove the callback was not consulted.
  let status: number | null = null
  try {
    const res = await handler(
      new Request(`http://x/@rsc/${encodeURIComponent(publicActionId)}`, {
        method: 'POST',
      })
    )
    status = res.status
  } catch {
    // decodeReply rejected on an empty body — not an auth failure.
    status = null
  }
  expect(status).not.toBe(401)
})
