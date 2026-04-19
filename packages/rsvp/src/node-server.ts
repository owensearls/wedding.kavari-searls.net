import { readdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { createRequestListener } from '@remix-run/node-fetch-server'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
// Import helpers from the BUILT rsc bundle. `entry.rsc.ts` pulls in
// `@vitejs/plugin-rsc/rsc`, which imports virtual modules that only resolve
// under Vite. The built bundle has those inlined, so it runs on plain Node.
// Run `pnpm build` before `pnpm start`.
// @ts-expect-error built artifact, no types
import { createRscHandler, runWithEnv } from '../dist/rsc/index.js'
import type { Database as DbSchema } from './server/shared/lib/schema.ts'

const CLIENT_DIR = resolve('dist/client')
const PORT = Number(process.env.PORT ?? 3000)

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH
  const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'
  try {
    const entries = readdirSync(dir)
    const match = entries.find(
      (e) => e.endsWith('.sqlite') && e !== 'metadata.sqlite'
    )
    if (match) return `${dir}/${match}`
  } catch {
    // fall through
  }
  throw new Error(
    'No local D1 SQLite file found. Run `pnpm db:migrate:local` first, or set SQLITE_PATH.'
  )
}

const sqlitePath = resolveSqlitePath()
const sqliteDb = new Database(sqlitePath)
const localKyselyDb = new Kysely<DbSchema>({
  dialect: new SqliteDialect({ database: sqliteDb }),
})

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
}

// No auth for the Node target: deployed behind a firewall / trusted network.
const rscHandler = createRscHandler()

async function serveStatic(pathname: string): Promise<Response | null> {
  const safe = pathname.replace(/\?.*$/, '').replace(/^\/+/, '')
  const filePath = join(CLIENT_DIR, safe || 'index.html')
  if (filePath !== CLIENT_DIR && !filePath.startsWith(`${CLIENT_DIR}/`))
    return null
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return null
    const buf = await readFile(filePath)
    return new Response(buf, {
      headers: {
        'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      },
    })
  } catch {
    return null
  }
}

const listener = createRequestListener(async (request) => {
  return runWithEnv({ DB: localKyselyDb }, async () => {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/@rsc/')) return rscHandler(request)
    const file = await serveStatic(url.pathname)
    if (file) return file
    // SPA fallback: /admin/* sub-routes must load the admin shell so the
    // admin React app can take over client-side routing. Everything else
    // falls back to the public index.html.
    const fallbackShell = url.pathname.startsWith('/admin/')
      ? join(CLIENT_DIR, 'admin', 'index.html')
      : join(CLIENT_DIR, 'index.html')
    const html = await readFile(fallbackShell)
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  })
})

createServer(listener).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`)
})
