import { readdirSync } from 'node:fs'
import { createRequestListener } from '@remix-run/node-fetch-server'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import {
  createServer,
  isRunnableDevEnvironment,
  type ViteDevServer,
} from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'
import type { Database as DbSchema } from '../../src/server/shared/lib/schema'
import type { IncomingMessage, ServerResponse } from 'node:http'

let server: ViteDevServer
let baseUrl: string
let sqliteDb: Database.Database
let localKyselyDb: Kysely<DbSchema>

async function getEncodeReply(): Promise<
  (args: unknown[]) => Promise<BodyInit>
> {
  // Use the `client.edge` vendor bundle directly: `@vitejs/plugin-rsc/browser`
  // has side-effect imports of virtual modules that only resolve under Vite
  // (not plain Node), and `client.browser` expects `__webpack_require__`. The
  // edge build is plain ESM/CJS and exposes the same `encodeReply`.
  const mod: { encodeReply: (args: unknown[]) => Promise<BodyInit> } =
    await import('@vitejs/plugin-rsc/vendor/react-server-dom/client.edge')
  return mod.encodeReply
}

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH
  const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  const entries = readdirSync(dir)
  const match = entries.find(
    (e) => e.endsWith('.sqlite') && e !== 'metadata.sqlite'
  )
  if (!match)
    throw new Error('no local D1 sqlite file; run pnpm db:migrate:local')
  return `${dir}/${match}`
}

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc
  if (!isRunnableDevEnvironment(env)) {
    throw new Error('rsc environment is not runnable')
  }
  return (await env.runner.import(id)) as T
}

beforeAll(async () => {
  sqliteDb = new Database(resolveSqlitePath())
  localKyselyDb = new Kysely<DbSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  })

  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await createServer({
    configFile: './vite.config.node.ts',
    server: { port, strictPort: false, host: '127.0.0.1' },
    appType: 'custom',
  })
  await server.listen()
  const addr = server.httpServer!.address()
  if (!addr || typeof addr === 'string') throw new Error('no address')
  baseUrl = `http://127.0.0.1:${addr.port}`

  // Load the RSC handler via the RSC env runner so server functions get the
  // RSC transform and carry $$id, and so virtual:rsc-utils/functions/modules
  // resolves through Vite's plugin chain.
  const server_ = await loadRscModule<
    typeof import('rsc-utils/functions/server')
  >('rsc-utils/functions/server')
  const functions = await loadRscModule<
    typeof import('../../src/rsc-functions')
  >('/src/rsc-functions.ts')

  const { handle } = server_.createRscHandlers(functions.functionsConfig)

  const ctx = await loadRscModule<
    typeof import('../../src/server/shared/context')
  >('/src/server/shared/context.ts')
  const runWithEnv = ctx.runWithEnv

  const listener = createRequestListener(async (request) => {
    try {
      const response = await runWithEnv({ DB: localKyselyDb }, () =>
        handle(request)
      )
      return response ?? new Response('not found', { status: 404 })
    } catch (e) {
      console.error('[test rsc handler error]', e)
      const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
      return new Response(msg, { status: 500 })
    }
  })

  server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
    if (
      !req.url?.startsWith('/@rsc-admin/') &&
      !req.url?.startsWith('/@rsc-public/')
    )
      return next()
    Promise.resolve(listener(req, res)).catch(next)
  })
}, 60_000)

afterAll(async () => {
  await server?.close()
  sqliteDb?.close()
})

function extractActionId(fn: unknown): string {
  if (!fn || typeof fn !== 'function') {
    throw new Error('not a function')
  }
  const id = (fn as { $$id?: unknown }).$$id
  if (typeof id !== 'string' || !id.includes('#')) {
    throw new Error(
      `server function missing $$id; got ${String(id)}. fn keys: ${Object.getOwnPropertyNames(
        fn
      ).join(',')}`
    )
  }
  return id
}

test('public RPC: lookupGuests returns 200 with matches array', async () => {
  const mod = await loadRscModule<
    typeof import('../../src/server/public/rsvp')
  >('/src/server/public/rsvp.ts')
  const id = extractActionId(mod.lookupGuests)

  const encodeReply = await getEncodeReply()
  const body = await encodeReply(['kavari'])
  const res = await fetch(`${baseUrl}/@rsc-public/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'rsc-action-id': id },
    body: body as BodyInit,
  })
  if (res.status !== 200) {
    const text = await res.text()
    throw new Error(`expected 200, got ${res.status}: ${text}`)
  }
  expect(res.status).toBe(200)
  const bodyText = await res.text()
  expect(bodyText.length).toBeGreaterThan(0)
})

test('unknown action id is rejected with 403', async () => {
  const encodeReply = await getEncodeReply()
  const body = await encodeReply([])
  const fakeId = 'deadbeef#nothing'
  const res = await fetch(
    `${baseUrl}/@rsc-public/${encodeURIComponent(fakeId)}`,
    {
      method: 'POST',
      headers: { 'rsc-action-id': fakeId },
      body: body as BodyInit,
    }
  )
  expect(res.status).toBe(403)
})

test('admin RPC returns 200', async () => {
  const mod = await loadRscModule<
    typeof import('../../src/server/admin/events')
  >('/src/server/admin/events.ts')
  const id = extractActionId(mod.listEvents)

  const encodeReply = await getEncodeReply()
  const body = await encodeReply([])
  const res = await fetch(`${baseUrl}/@rsc-admin/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'rsc-action-id': id },
    body: body as BodyInit,
  })
  if (res.status !== 200) {
    const text = await res.text()
    throw new Error(`expected 200, got ${res.status}: ${text}`)
  }
  expect(res.status).toBe(200)
})

test('public action id rejected on admin prefix', async () => {
  const mod = await loadRscModule<
    typeof import('../../src/server/public/rsvp')
  >('/src/server/public/rsvp.ts')
  const id = extractActionId(mod.lookupGuests)

  const encodeReply = await getEncodeReply()
  const body = await encodeReply(['test'])
  const res = await fetch(`${baseUrl}/@rsc-admin/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'rsc-action-id': id },
    body: body as BodyInit,
  })
  expect(res.status).toBe(403)
})
