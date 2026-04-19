# Admin / Public RSC URL-Prefix Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the shared `/@rsc/` RSC endpoint onto two separate URL prefixes — `/@rsc-admin/` and `/@rsc-public/` — so Cloudflare Access can gate `/@rsc-admin/*` at the edge. Relocate shared server helpers into `src/server/shared/` so admin/public/shared are three peer directories with lint-enforced import boundaries between admin and public.

**Architecture:**
- Each of `src/server/admin/` and `src/server/public/` grows a new `rsc-entry.ts` that globs only its own server-action modules and exports a `{ fetch }` handler bound to its URL prefix. The old single-endpoint factory at `src/entry.rsc.ts` goes away.
- `src/worker.ts` becomes a path-prefix dispatcher: `/@rsc-admin/*` → admin entry, `/@rsc-public/*` → public entry, everything else → static assets (SPA fallback unchanged).
- The admin entry performs Cloudflare Access JWT verification with a localhost bypass (defense-in-depth alongside the Access rule at the edge). The public entry needs no auth.
- Both client SPAs share one parameterized `rsc-client.ts`; each `main.tsx` passes its own prefix into `setupServerCallback`.
- One Vite build, one Worker bundle, one wrangler.toml. No pnpm workspaces, no monorepo tooling, no separate build configs. The single frontend stays intact — this change only touches the server-side routing and code organization.

**Tech Stack:** No additions. Node 22, Vite 8, `@vitejs/plugin-rsc`, `@cloudflare/vite-plugin`, Wrangler 4, TypeScript 5.9.

**Execution guidance:**
- One commit per task where possible. Each phase ends with `pnpm test` green.
- Never `git add -A` — use explicit paths (there's a lot of file movement).
- Keep the dev server on `http://localhost:5173/admin/groups` as a smoke-test target. The Playwright probe from `/tmp/pw-debug/probe.mjs` catches RSC regressions quickly.

---

## File Structure (target)

```
src/
├── admin/                          (unchanged — client SPA)
├── components/                     (unchanged)
├── routes/                         (unchanged)
├── lib/                            (unchanged)
├── App.tsx App.css App.module.css  (unchanged)
├── index.css typography.module.css (unchanged)
├── main.tsx                        setupServerCallback("/@rsc-public/")
├── admin/main.tsx                  setupServerCallback("/@rsc-admin/")
├── rsc-client.ts                   parameterized: setupServerCallback(prefix)
├── worker.ts                       dispatches /@rsc-admin and /@rsc-public
├── node-server.ts                  dev Node server: same dispatch
├── vite/admin-spa-fallback.ts      (unchanged)
├── entry.rsc.ts                    [DELETED]
└── server/
    ├── admin/
    │   ├── events.ts groups.ts guests.ts import.ts responses.ts   (unchanged content)
    │   └── rsc-entry.ts            NEW: globs ./*.ts, auth + JWT verify, /@rsc-admin/
    ├── public/
    │   ├── rsvp.ts                 (unchanged content)
    │   └── rsc-entry.ts            NEW: globs ./*.ts, no auth, /@rsc-public/
    └── shared/                     NEW subdir (files moved from src/server/*)
        ├── context.ts              (was src/server/context.ts)
        ├── auth.ts                 (was src/server/auth.ts)
        └── lib/
            ├── db.ts               (was src/server/lib/db.ts)
            ├── schema.ts           (was src/server/lib/schema.ts)
            ├── fuzzy.ts            (was src/server/lib/fuzzy.ts)
            ├── db.test.ts          (was src/server/lib/db.test.ts)
            └── fuzzy.test.ts       (was src/server/lib/fuzzy.test.ts)
shared/schemas/                     (unchanged — stays at root, @shared alias still works)
```

Routing:
- `GET /` → public shell (`index.html`)
- `GET /admin/...` → admin shell (`admin/index.html`, via SPA fallback)
- `POST /@rsc-admin/<id>` → admin entry (Access-gated in prod, localhost-open in dev)
- `POST /@rsc-public/<id>` → public entry (open)
- Everything else → static assets

---

## Phase 0 — Pre-flight

### Task 0.1: Clean baseline, commit this plan

- [ ] **Step 1: Verify working tree clean and tests green**

```bash
git status
pnpm db:migrate:local
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: clean, 78/78 tests, zero errors, no formatting drift.

- [ ] **Step 2: Remove the superseded workspace-split plan**

```bash
git rm docs/plans/2026-04-18-workspace-split.md
```

- [ ] **Step 3: Commit the plan swap**

```bash
git add docs/plans/2026-04-19-admin-public-url-split.md
git commit -m "Replace workspace-split plan with URL-prefix split plan"
```

---

## Phase 1 — Move shared server code into `src/server/shared/`

Goal: everything under `src/server/` that's neither admin nor public lives under `src/server/shared/`. The admin/public subdirs keep their existing contents; their imports get redirected to the new shared location.

### Task 1.1: Move context.ts and auth.ts

**Files:**
- Move: `src/server/context.ts` → `src/server/shared/context.ts`
- Move: `src/server/auth.ts` → `src/server/shared/auth.ts`

- [ ] **Step 1: Move with `git mv`**

```bash
mkdir -p src/server/shared
git mv src/server/context.ts src/server/shared/context.ts
git mv src/server/auth.ts src/server/shared/auth.ts
```

- [ ] **Step 2: Update imports**

Known callers (use `Grep pattern="from ['\"](\\.\\./)+server/(context|auth)"`or `Grep pattern="server/context"` to enumerate):

- `src/worker.ts` — `from './server/context'` → `from './server/shared/context'`; `from './server/auth'` → `from './server/shared/auth'`
- `src/server/admin/events.ts` — `from '../context'` → `from '../shared/context'`
- `src/server/admin/groups.ts` — same
- `src/server/admin/guests.ts` — same
- `src/server/admin/import.ts` — same
- `src/server/admin/responses.ts` — same
- `src/server/public/rsvp.ts` — same
- `src/entry.rsc.ts` — (no changes needed, doesn't import these)
- `src/node-server.ts` — `../dist/rsc/index.js` (no source import)
- `tests/e2e/feature-parity.test.ts` — module specifier `/src/server/context.ts` → `/src/server/shared/context.ts`; also the type import `../../src/server/context` → `../../src/server/shared/context`
- `tests/e2e/rpc.roundtrip.test.ts` — same pattern

Run the update, then verify with:

```bash
Grep pattern="server/(context|auth)" path="/Users/owen/workspace/wedding.kavari-searls.net"
```

Every hit should point at `server/shared/{context,auth}`.

- [ ] **Step 3: Run tests + typecheck + lint**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: 78/78 tests pass, tsc clean, lint clean.

- [ ] **Step 4: Commit**

```bash
git add src tests
git commit -m "Move server/{context,auth}.ts into server/shared/"
```

---

### Task 1.2: Move the `lib/` dir into shared

**Files:**
- Move: `src/server/lib/db.ts` → `src/server/shared/lib/db.ts`
- Move: `src/server/lib/schema.ts` → `src/server/shared/lib/schema.ts`
- Move: `src/server/lib/fuzzy.ts` → `src/server/shared/lib/fuzzy.ts`
- Move: `src/server/lib/db.test.ts` → `src/server/shared/lib/db.test.ts`
- Move: `src/server/lib/fuzzy.test.ts` → `src/server/shared/lib/fuzzy.test.ts`

- [ ] **Step 1: Move**

```bash
mkdir -p src/server/shared/lib
git mv src/server/lib/db.ts src/server/shared/lib/db.ts
git mv src/server/lib/schema.ts src/server/shared/lib/schema.ts
git mv src/server/lib/fuzzy.ts src/server/shared/lib/fuzzy.ts
git mv src/server/lib/db.test.ts src/server/shared/lib/db.test.ts
git mv src/server/lib/fuzzy.test.ts src/server/shared/lib/fuzzy.test.ts
rmdir src/server/lib
```

- [ ] **Step 2: Update imports**

Enumerate with: `Grep pattern="server/lib/"`.

- `src/server/shared/context.ts` — `from './lib/schema'` → `from './lib/schema'` (no change; lib/ moved with it)
- `src/server/admin/events.ts` — `from '../lib/db'` → `from '../shared/lib/db'`
- `src/server/admin/groups.ts` — same
- `src/server/admin/guests.ts` — same
- `src/server/admin/import.ts` — same
- `src/server/admin/responses.ts` — same
- `src/server/public/rsvp.ts` — `from '../lib/db'` → `from '../shared/lib/db'`; `from '../lib/fuzzy'` → `from '../shared/lib/fuzzy'`
- `src/node-server.ts` — type import `./server/lib/schema.ts` → `./server/shared/lib/schema.ts`
- `tests/e2e/feature-parity.test.ts` — `../../src/server/lib/schema` → `../../src/server/shared/lib/schema`
- `tests/e2e/rpc.roundtrip.test.ts` — same

Verify:

```bash
Grep pattern="server/lib/"
```

Should return zero hits (except possibly inside this plan doc).

- [ ] **Step 3: Update `vitest.config.ts` include patterns**

Current:
```ts
include: [
  'functions/**/*.test.ts',
  'shared/**/*.test.ts',
  'src/**/*.test.ts',
  'tests/**/*.test.ts',
],
```

The `src/**` pattern already covers the new location. No changes needed. Verify by running tests.

- [ ] **Step 4: Run tests**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: 78/78, clean.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "Move server/lib/ into server/shared/lib/"
```

---

### Phase 1 checkpoint

```bash
ls src/server
```

Expected:
```
admin/
public/
shared/
```

Only three directories, no stray files. `src/server/shared/` contains `context.ts`, `auth.ts`, `lib/`.

---

## Phase 2 — Per-package RSC entries

### Task 2.1: Write the admin RSC entry

**Files:**
- Create: `src/server/admin/rsc-entry.ts`

- [ ] **Step 1: Write the file**

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'
import { verifyAccessJwt } from '../shared/auth'
import { getEnv } from '../shared/context'

// Glob every admin server-action module. plugin-rsc attaches $$id to each
// "use server" export during graph walk; we collect those ids for validation.
const adminModules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true,
})
// The glob includes this file. Filter it out so we don't try to register the
// handler itself as a server action.
delete (adminModules as Record<string, unknown>)['./rsc-entry.ts']

function collectActionIds(
  modules: Record<string, unknown>[]
): Set<string> {
  const ids = new Set<string>()
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key]
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}

const actionIds = collectActionIds(Object.values(adminModules))
const RSC_PREFIX = '/@rsc-admin/'

// Loopback hostnames can only be reached in local dev — Cloudflare won't route
// a request with hostname "localhost" to a deployed Worker.
const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
])

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(RSC_PREFIX)) {
      return new Response('Not found', { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Defense-in-depth. Cloudflare Access should gate /@rsc-admin/* at the
    // edge (one dashboard path rule), but re-verify the JWT here so a direct
    // hit to the Worker's *.workers.dev URL (if ever enabled) can't bypass.
    if (!LOCAL_HOSTNAMES.has(url.hostname)) {
      const env = getEnv() as {
        ACCESS_AUD?: string
        ACCESS_TEAM_DOMAIN?: string
      }
      const ok =
        env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN
          ? await verifyAccessJwt(request, {
              aud: env.ACCESS_AUD,
              teamDomain: env.ACCESS_TEAM_DOMAIN,
            })
          : false
      if (!ok) return new Response('Unauthorized', { status: 401 })
    }

    const actionId = decodeURIComponent(url.pathname.slice(RSC_PREFIX.length))
    if (!actionIds.has(actionId)) {
      return new Response('Forbidden', { status: 403 })
    }

    const contentType = request.headers.get('content-type') ?? ''
    const body = contentType.includes('multipart/form-data')
      ? await request.formData()
      : await request.text()

    const args = (await decodeReply(body)) as unknown[]
    const fn = (await loadServerAction(actionId)) as (
      ...args: unknown[]
    ) => unknown
    const result = await fn(...args)

    const stream = renderToReadableStream(result)
    return new Response(stream, {
      headers: { 'content-type': 'text/x-component' },
    })
  },
} satisfies { fetch: (request: Request) => Promise<Response> }
```

Notes:
- Reads Access config from `getEnv()` (the AsyncLocalStorage-backed env) — no more `globalThis` shim.
- The cast `getEnv() as { ACCESS_AUD?: string; ACCESS_TEAM_DOMAIN?: string }` is needed because `ServerEnv` is a union where only the Worker variant has those fields.

- [ ] **Step 2: Commit**

```bash
git add src/server/admin/rsc-entry.ts
git commit -m "Add admin RSC entry bound to /@rsc-admin/"
```

---

### Task 2.2: Write the public RSC entry

**Files:**
- Create: `src/server/public/rsc-entry.ts`

- [ ] **Step 1: Write the file**

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'

const publicModules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true,
})
delete (publicModules as Record<string, unknown>)['./rsc-entry.ts']

function collectActionIds(
  modules: Record<string, unknown>[]
): Set<string> {
  const ids = new Set<string>()
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key]
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}

const actionIds = collectActionIds(Object.values(publicModules))
const RSC_PREFIX = '/@rsc-public/'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(RSC_PREFIX)) {
      return new Response('Not found', { status: 404 })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const actionId = decodeURIComponent(url.pathname.slice(RSC_PREFIX.length))
    if (!actionIds.has(actionId)) {
      return new Response('Forbidden', { status: 403 })
    }

    const contentType = request.headers.get('content-type') ?? ''
    const body = contentType.includes('multipart/form-data')
      ? await request.formData()
      : await request.text()

    const args = (await decodeReply(body)) as unknown[]
    const fn = (await loadServerAction(actionId)) as (
      ...args: unknown[]
    ) => unknown
    const result = await fn(...args)

    const stream = renderToReadableStream(result)
    return new Response(stream, {
      headers: { 'content-type': 'text/x-component' },
    })
  },
} satisfies { fetch: (request: Request) => Promise<Response> }
```

No auth — public actions are open by design.

- [ ] **Step 2: Commit**

```bash
git add src/server/public/rsc-entry.ts
git commit -m "Add public RSC entry bound to /@rsc-public/"
```

---

### Task 2.3: Parameterize `rsc-client.ts`

**Files:**
- Modify: `src/rsc-client.ts`

- [ ] **Step 1: Replace the exported function**

Current (after the earlier Fix B response-validation change):

```ts
export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
    const response = fetch(`/@rsc/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'rsc-action-id': id },
      body,
    }).then(async (res) => {
      // ... response validation ...
    })
    return createFromFetch(response)
  })
}
```

New (prefix parameter; validation kept intact):

```ts
import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser'

export function setupServerCallback(prefix: string): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
    // Validate the response shape before handing it to createFromFetch.
    // Without this, any non-Flight body (e.g. a 401 "Unauthorized" plaintext)
    // fails deep inside the Flight parser as a generic "Connection closed.",
    // which hides the real status and makes auth/network errors un-debuggable.
    const response = fetch(`${prefix}${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'rsc-action-id': id },
      body,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Server action ${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
        )
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/x-component')) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Server action ${id} returned unexpected content-type "${ct || '<missing>'}": ${text.slice(0, 200)}`
        )
      }
      return res
    })
    return createFromFetch(response)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/rsc-client.ts
git commit -m "Parameterize setupServerCallback with URL prefix"
```

---

### Task 2.4: Update the two main.tsx files to pass their prefix

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/admin/main.tsx`

- [ ] **Step 1: `src/main.tsx`**

Change:
```ts
setupServerCallback()
```
to:
```ts
setupServerCallback('/@rsc-public/')
```

- [ ] **Step 2: `src/admin/main.tsx`**

Change:
```ts
setupServerCallback()
```
to:
```ts
setupServerCallback('/@rsc-admin/')
```

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx src/admin/main.tsx
git commit -m "Pass per-SPA RSC URL prefix into setupServerCallback"
```

---

## Phase 3 — Rewrite the worker as a prefix dispatcher

### Task 3.1: Replace `src/worker.ts`

**Files:**
- Modify: `src/worker.ts`

- [ ] **Step 1: Rewrite**

Current (~60 lines, wraps `createRscHandler` with an authorize callback and the globalThis shim). Replace with a dispatcher that delegates to the two per-package entries:

```ts
import { runWithEnv } from './server/shared/context'
import adminEntry from './server/admin/rsc-entry'
import publicEntry from './server/public/rsc-entry'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ACCESS_AUD?: string
  ACCESS_TEAM_DOMAIN?: string
}

// Re-export so the Node production server can reach runWithEnv via the
// built `dist/rsc/index.js` (which inlines virtual RSC modules).
export { runWithEnv }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const url = new URL(request.url)

      if (url.pathname.startsWith('/@rsc-admin/')) {
        return adminEntry.fetch(request)
      }
      if (url.pathname.startsWith('/@rsc-public/')) {
        return publicEntry.fetch(request)
      }

      // Static assets + SPA fallback (same behavior as before).
      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) return assetResponse

      const shellPath = url.pathname.startsWith('/admin/') ? '/admin/' : '/'
      const shellUrl = new URL(shellPath, url)
      return env.ASSETS.fetch(new Request(shellUrl, request))
    })
  },
} satisfies ExportedHandler<Env>
```

What went away:
- The `createRscHandler(authorize)` wrapper — the admin entry enforces auth itself.
- The `globalThis.ACCESS_AUD` / `globalThis.ACCESS_TEAM_DOMAIN` shim + TODO — admin entry reads from `getEnv()`.
- The `LOCAL_HOSTNAMES` set — moved into the admin entry (it's an admin-only concern).
- `import { createRscHandler }` re-export — entry.rsc.ts is deleted in Task 3.2 and nobody imports it after these changes.

- [ ] **Step 2: Commit**

```bash
git add src/worker.ts
git commit -m "Make worker a URL-prefix dispatcher; drop globalThis shim"
```

---

### Task 3.2: Delete `src/entry.rsc.ts`

**Files:**
- Delete: `src/entry.rsc.ts`

- [ ] **Step 1: Verify no remaining callers**

```bash
Grep pattern="entry\\.rsc"
```

Expected: zero hits in `src/`. Tests will still reference it — they get updated in Phase 4.

- [ ] **Step 2: Delete**

```bash
git rm src/entry.rsc.ts
```

- [ ] **Step 3: Run `pnpm build` to confirm nothing pulls it in transitively**

```bash
pnpm build
```

Expected: build succeeds. If it fails with "cannot resolve entry.rsc.ts", there's a vite config pointing at it — update that config (expected only in `vite.config.ts` / `vite.config.node.ts`; both currently point at `./src/worker.ts`, which is fine).

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove unused entry.rsc.ts factory"
```

---

## Phase 4 — Update the Node dev server

### Task 4.1: `src/node-server.ts` dispatches both prefixes

The Node server currently mounts ONE `/@rsc/` handler from the built bundle. It needs to match the Cloudflare worker's new dispatch — handling `/@rsc-admin/` and `/@rsc-public/` via the same per-package entries.

**Files:**
- Modify: `src/node-server.ts`

- [ ] **Step 1: Read the current file**

Use the Read tool. The current structure:
- Imports `createRscHandler` + `runWithEnv` from `../dist/rsc/index.js`
- Sets up a single `rscHandler = createRscHandler()` with no auth
- Middleware branches on `url.pathname.startsWith("/@rsc/")` to route to that handler

- [ ] **Step 2: Replace**

The new structure imports the dispatcher directly from the built worker bundle (same pattern the dispatcher already uses internally):

```ts
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { createRequestListener } from '@remix-run/node-fetch-server'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
// @ts-expect-error built artifact, no types
import dispatcher from '../dist/rsc/index.js'
import type { Database as DbSchema } from './server/shared/lib/schema'

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
    /* fall through */
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

async function serveStatic(pathname: string): Promise<Response | null> {
  const safe = pathname.replace(/\?.*$/, '').replace(/^\/+/, '')
  const filePath = join(CLIENT_DIR, safe || 'index.html')
  if (filePath !== CLIENT_DIR && !filePath.startsWith(`${CLIENT_DIR}/`)) {
    return null
  }
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

// Fake env matching the Worker Env contract. ASSETS is a static-file reader;
// the dispatcher's SPA fallback will call it again for the admin/public shell.
const env = {
  DB: localKyselyDb,
  ASSETS: {
    async fetch(request: Request | string): Promise<Response> {
      const url = new URL(typeof request === 'string' ? request : request.url)
      const file = await serveStatic(url.pathname)
      if (file) return file
      return new Response('not found', { status: 404 })
    },
  },
}

const listener = createRequestListener(async (request) =>
  dispatcher.fetch(request, env)
)

createServer(listener).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`)
})
```

Notes:
- `dispatcher.fetch(request, env)` does everything: runs `runWithEnv`, dispatches /@rsc-admin/ and /@rsc-public/, serves static assets, and does SPA fallback. No more duplicating that logic here.
- `env.ASSETS.fetch` is called by the dispatcher; we implement it with the existing static-file reader.
- The `DB` field is a Kysely instance instead of a `D1Database` — that's fine because `getDb()` in shared/lib/db.ts duck-types on `selectFrom`.
- The admin sub-handler's hostname bypass still applies: on localhost the JWT check is skipped, so admin actions work in Node dev exactly like they did before.

- [ ] **Step 3: Confirm `pnpm start` still works**

```bash
pnpm start
```

In another terminal:
```bash
curl -s http://localhost:3000/ | head -5
curl -s http://localhost:3000/admin/ | head -5
```

Both should return HTML. Kill the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add src/node-server.ts
git commit -m "Use the worker dispatcher in node-server.ts"
```

---

## Phase 5 — Tests

### Task 5.1: Rewrite `tests/e2e/admin-auth.test.ts`

The old test exercised the `createRscHandler(authorize)` wrapper pattern. That's gone — admin auth now lives inside `src/server/admin/rsc-entry.ts`. Rewrite to exercise that entry directly.

**Files:**
- Modify: `tests/e2e/admin-auth.test.ts`

- [ ] **Step 1: Replace with a new test set**

```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import {
  createServer,
  isRunnableDevEnvironment,
  type ViteDevServer,
} from 'vite'

let server: ViteDevServer
let adminEntry: { fetch: (req: Request) => Promise<Response> }
let runWithEnv: typeof import('../../src/server/shared/context').runWithEnv
let adminActionId: string

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
  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await createServer({
    configFile: './vite.config.node.ts',
    server: { port, strictPort: false, host: '127.0.0.1' },
    appType: 'custom',
  })
  await server.listen()

  const entry = await loadRscModule<{ default: typeof adminEntry }>(
    '/src/server/admin/rsc-entry.ts'
  )
  adminEntry = entry.default

  const ctx = await loadRscModule<
    typeof import('../../src/server/shared/context')
  >('/src/server/shared/context.ts')
  runWithEnv = ctx.runWithEnv

  const events = await loadRscModule<
    typeof import('../../src/server/admin/events')
  >('/src/server/admin/events.ts')
  adminActionId = extractActionId(events.listEvents)
}, 60_000)

afterAll(async () => {
  await server?.close()
})

test('rejects non-local request with no Access JWT (401)', async () => {
  const res = await runWithEnv(
    { DB: undefined as never, ACCESS_AUD: 'unset', ACCESS_TEAM_DOMAIN: 'unset' },
    () =>
      adminEntry.fetch(
        new Request(
          `https://wedding.example.com/@rsc-admin/${encodeURIComponent(adminActionId)}`,
          { method: 'POST' }
        )
      )
  )
  expect(res.status).toBe(401)
})

test('localhost request bypasses JWT; unknown action returns 403', async () => {
  const res = await runWithEnv({ DB: undefined as never }, () =>
    adminEntry.fetch(
      new Request(
        `http://localhost/@rsc-admin/${encodeURIComponent('fake#id')}`,
        { method: 'POST' }
      )
    )
  )
  expect(res.status).toBe(403)
})

test('localhost request with real admin action id is past the auth gate', async () => {
  // The action will fail to run because DB is undefined, but any status other
  // than 401 proves the auth gate was bypassed.
  let status: number | null = null
  try {
    const res = await runWithEnv({ DB: undefined as never }, () =>
      adminEntry.fetch(
        new Request(
          `http://localhost/@rsc-admin/${encodeURIComponent(adminActionId)}`,
          { method: 'POST' }
        )
      )
    )
    status = res.status
  } catch {
    status = null
  }
  expect(status).not.toBe(401)
})
```

Notes:
- Uses the existing `./vite.config.node.ts` (no changes needed since we're not changing Vite configs in this plan).
- The `DB: undefined as never` cast is a test-only hack: the admin entry's auth gate runs before any DB access, so the test doesn't need a real DB.

- [ ] **Step 2: Run just this test**

```bash
pnpm exec vitest run tests/e2e/admin-auth.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-auth.test.ts
git commit -m "Rewrite admin-auth test for per-entry auth gate"
```

---

### Task 5.2: Update `tests/e2e/rpc.roundtrip.test.ts`

Two changes needed:
1. Module paths: `/src/server/context.ts` → `/src/server/shared/context.ts`, `/src/server/lib/schema.ts` → `/src/server/shared/lib/schema.ts`, `/src/entry.rsc.ts` removed.
2. The test no longer uses `createRscHandler` — it wires the two per-package entries into the middleware dispatch.

**Files:**
- Modify: `tests/e2e/rpc.roundtrip.test.ts`

- [ ] **Step 1: Replace the relevant sections**

Read the current file for context, then update:

**Imports (top of file):**

```ts
import type { Database as DbSchema } from '../../src/server/shared/lib/schema'
```

(and verify other type imports — if any still reference the old `/src/server/context` or `/src/server/lib/*` paths, update to `/src/server/shared/...`)

**`beforeAll` — load modules and mount the dispatcher:**

Replace the block that loads `entry.rsc.ts` and creates `rscHandler` with loads of the two per-package entries, and replace the single-prefix middleware with a two-prefix one:

```ts
const adminEntry = await loadRscModule<{
  default: { fetch: (req: Request) => Promise<Response> }
}>('/src/server/admin/rsc-entry.ts')

const publicEntry = await loadRscModule<{
  default: { fetch: (req: Request) => Promise<Response> }
}>('/src/server/public/rsc-entry.ts')

const ctx = await loadRscModule<
  typeof import('../../src/server/shared/context')
>('/src/server/shared/context.ts')
const runWithEnv = ctx.runWithEnv

const listener = createRequestListener(async (request) => {
  const url = new URL(request.url)
  try {
    if (url.pathname.startsWith('/@rsc-admin/')) {
      return await runWithEnv({ DB: localKyselyDb }, () =>
        adminEntry.default.fetch(request)
      )
    }
    if (url.pathname.startsWith('/@rsc-public/')) {
      return await runWithEnv({ DB: localKyselyDb }, () =>
        publicEntry.default.fetch(request)
      )
    }
    return new Response('not found', { status: 404 })
  } catch (e) {
    console.error('[test dispatcher error]', e)
    const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e)
    return new Response(msg, { status: 500 })
  }
})

server.middlewares.use(
  (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next) => {
    const startsWith =
      req.url?.startsWith('/@rsc-admin/') || req.url?.startsWith('/@rsc-public/')
    if (!startsWith) return next()
    Promise.resolve(listener(req, res)).catch(next)
  }
)
```

**Tests — update URL prefixes in the fetches:**

The test `"public RPC: lookupGuests returns 200..."` does:
```ts
const res = await fetch(`${baseUrl}/@rsc/${encodeURIComponent(id)}`, { ... })
```
→ update to `${baseUrl}/@rsc-public/...`

The test `"unknown action id is rejected with 403"` — keep hitting `/@rsc-public/` (the fake id is neither admin nor public, so 403 either way; pick public for clarity).

The test `"admin RPC (no auth in Node dev) returns 200"` — update to `${baseUrl}/@rsc-admin/...`.

Also: each test's type-level `typeof import(...)` specifiers stay (the `consistent-type-imports` rule allows them), but update paths:
- `typeof import('../../src/server/public/rsvp')` stays (public/rsvp didn't move)
- `typeof import('../../src/server/admin/events')` stays
- `typeof import('../../src/entry.rsc.ts')` DELETED (entry.rsc is gone)

- [ ] **Step 2: Run this test**

```bash
pnpm exec vitest run tests/e2e/rpc.roundtrip.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/rpc.roundtrip.test.ts
git commit -m "Update RPC roundtrip test for per-prefix dispatch"
```

---

### Task 5.3: Update `tests/e2e/feature-parity.test.ts` paths

This test calls server actions directly (not over HTTP), so no URL-prefix changes — only module path updates.

**Files:**
- Modify: `tests/e2e/feature-parity.test.ts`

- [ ] **Step 1: Update path patterns**

Find-and-replace:
```
"/src/server/context.ts"            →  "/src/server/shared/context.ts"
"/src/server/lib/schema"            →  "/src/server/shared/lib/schema"
"../../src/server/context"          →  "../../src/server/shared/context"
"../../src/server/lib/schema"       →  "../../src/server/shared/lib/schema"
```

The `/src/server/public/rsvp.ts` and `/src/server/admin/*.ts` paths stay — those files didn't move.

Enumerate remaining references to verify:

```bash
Grep pattern="server/(context|lib)" path="tests"
```

Should return zero hits.

- [ ] **Step 2: Run this test**

```bash
pnpm exec vitest run tests/e2e/feature-parity.test.ts
```

Expected: 12 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/feature-parity.test.ts
git commit -m "Update feature-parity test paths for server/shared/ move"
```

---

### Phase 5 checkpoint

```bash
pnpm test
```

Expected: 78/78 pass.

---

## Phase 6 — Lint-enforced import boundaries

### Task 6.1: Add `no-restricted-imports` rules

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add two file-scoped rule blocks**

Append to the `defineConfig([...])` array (before the `eslintConfigPrettier` entry at the end):

```js
  // Admin server code cannot import from public server code.
  {
    files: ['src/server/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/public/**', '../public/**'],
              message:
                'Admin server code must not import from public server code. Put shared helpers under src/server/shared/.',
            },
          ],
        },
      ],
    },
  },
  // Public server code cannot import from admin server code.
  {
    files: ['src/server/public/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/admin/**', '../admin/**'],
              message:
                'Public server code must not import from admin server code.',
            },
          ],
        },
      ],
    },
  },
```

Place these before the final `eslintConfigPrettier` entry (order matters for lint-disable purposes).

- [ ] **Step 2: Verify the boundaries are enforced**

Temporarily add a bad import to prove the rule works:

```bash
# In src/server/admin/events.ts, add a line at the top:
# import { lookupGuests } from '../public/rsvp'
# Then:
pnpm lint 2>&1 | grep no-restricted-imports
```

Expected: lint error pointing at the new line. **Remove the bad import** before committing.

- [ ] **Step 3: Final lint pass**

```bash
pnpm lint
```

Expected: 0 errors, 0 warnings (the react-hooks warning was fixed earlier with `useWatch`).

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "Lint-enforce admin/public server code separation"
```

---

## Phase 7 — Final verification

### Task 7.1: Full sweep

- [ ] **Step 1: Clean rebuild of local D1 state**

```bash
rm -rf .wrangler/state
pnpm db:migrate:local
```

- [ ] **Step 2: Run every check**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format:check && pnpm build
```

Expected: 78/78 tests, zero tsc errors, zero lint errors/warnings, format clean, build succeeds.

---

### Task 7.2: Dev server smoke test with Playwright

- [ ] **Step 1: Start dev**

```bash
pnpm dev
```

- [ ] **Step 2: Run the Playwright probe against both URLs**

Use the existing `/tmp/pw-debug/probe.mjs` from earlier debugging. It needs a one-line change to accept a URL via env var — or hard-code both URLs.

```bash
cd /tmp/pw-debug && node probe.mjs 2>&1 | grep -E '(status|body-text|pageerror)' | head -20
```

Expected for `http://localhost:5173/admin/groups`:
- Body text includes "Wedding Admin" and a guest row
- No 401s
- No "Connection closed."
- RSC responses hit `/@rsc-admin/...` with status 200, content-type `text/x-component`

Expected for `http://localhost:5173/`:
- Body text includes "Sanam Louise Kavari" and "will be married"
- No errors
- RSC responses hit `/@rsc-public/...` if any (the public homepage might not trigger RSC actions on first paint)

- [ ] **Step 3: Manual exercise of an RSC action**

In the browser at `http://localhost:5173/rsvp/<some-code>` (any RSVP flow that calls `lookupGuests`), confirm the request goes to `/@rsc-public/...`.

Same on `http://localhost:5173/admin/groups`, exercise an admin action (e.g., click "New invite", save) — request goes to `/@rsc-admin/...`.

- [ ] **Step 4: Kill dev server**

---

### Task 7.3: Cloudflare Access dashboard update (manual)

**Not a code change — one field edit in the Cloudflare dashboard.**

- [ ] **Step 1: Log in → Zero Trust → Access → Applications**

- [ ] **Step 2: Find the application gating the wedding site**

- [ ] **Step 3: Update path rules**

If the current Access app's included paths are `/@rsc*` and/or `/admin*`, change to:
- Include `/admin*`
- Include `/@rsc-admin*`

Do **not** include `/@rsc-public*` — public actions must be reachable without authentication.

- [ ] **Step 4: Save and deploy**

After the next `pnpm exec wrangler deploy` (or CI push to `main`), test:
- `https://wedding.kavari-searls.net/` should load without the Access gate.
- `https://wedding.kavari-searls.net/admin/groups` should show the Access login.
- After logging in, admin actions should succeed (JWT injected by Access, verified in the admin rsc-entry).
- Trying to hit `/@rsc-admin/<valid-id>` without an Access session should 401.

---

### Task 7.4: Remove this plan (optional)

Once verified in prod:

- [ ] **Step 1: Remove**

```bash
git rm docs/plans/2026-04-19-admin-public-url-split.md
git commit -m "Remove completed URL-prefix split plan"
```

Or keep it under `docs/plans/` as historical record — user preference.

---

## Appendix A — What this plan does NOT do

Explicitly out of scope (could be a future plan):

- **No pnpm workspaces.** All code stays in `src/`. Boundary enforcement is via ESLint `no-restricted-imports`, not package.json.
- **No frontend split.** One Vite build, one client bundle, one HTML shell per SPA (same as today — `index.html` and `admin/index.html`).
- **No separate RSC graphs.** plugin-rsc walks a single graph from `src/worker.ts`. Both admin and public action IDs live in the same RSC bundle. The auth boundary is enforced by URL prefix + per-entry allowlist, not by bundle separation.
- **No bundle hygiene.** The admin client bundle still ships public-only deps and vice versa, because it's the same bundle.
- **No Cloudflare dashboard deploy migration.** CI workflow + `wrangler deploy` unchanged.
- **No Kysely migration authoring.** `wrangler d1 migrations apply` flow unchanged.

If any of these become actual pain, a future plan addresses them.

## Appendix B — Common pitfalls

- **`import.meta.glob` self-reference:** each rsc-entry globs `./*.ts`, which includes itself. The `delete modules['./rsc-entry.ts']` line handles it. Verify in dev by logging `Object.keys(adminModules)` once from the entry — should show admin action files only.
- **`ServerEnv` union narrowing:** `getEnv()` returns a union where only the Worker variant has `ACCESS_AUD`/`ACCESS_TEAM_DOMAIN`. The cast in admin/rsc-entry.ts is what lets TypeScript compile without a discriminator; the runtime check (`env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN`) ensures we don't try to verify against a Node-mode env that lacks those fields.
- **Prettier on the rsc-entry files:** single-quote, no-semi style per `.prettierrc`. If you paste the code blocks from this plan verbatim, run `pnpm format` before committing.
- **The Access JWT is per-request in prod; localhost bypass is per-origin.** If you set up a tunneling tool (ngrok, cloudflared tunnel) that surfaces the Worker on a non-localhost hostname, admin requests through it WILL require a JWT. That's correct — the localhost bypass is specifically for the dev loopback.
