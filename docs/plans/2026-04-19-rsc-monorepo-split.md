# RSC Monorepo Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the wedding RSVP site into a pnpm workspace with two packages — `packages/rsvp/` (Cloudflare Worker serving admin SPA + RSC endpoints) and `packages/frontend/` (static site importing pre-built public server action stubs from rsvp). The rsvp build generates client stubs via a custom vite plugin that reads `@vitejs/plugin-rsc` metadata.

**Architecture:**
- `packages/rsvp/` owns all server code, the admin SPA, and the Cloudflare Worker. Its vite build (plugin-rsc + cloudflare) produces three outputs: the worker bundle, admin SPA assets, and client API stubs (`dist/client-api/public.js`). The worker dispatches `/@rsc-admin/` (JWT-gated, same-origin) and `/@rsc-public/` (CORS-enabled, open) to separate RSC handlers.
- `packages/frontend/` is a plain Vite+React app (no plugin-rsc). It depends on the `rsvp` workspace package and imports `rsvp/api/public` which resolves to the pre-built stubs. It builds to fully static HTML/JS for GitHub Pages.
- `shared/` (Zod schemas) stays at the workspace root.

**Tech Stack:** No additions. Node 22, Vite 8, `@vitejs/plugin-rsc` 0.5.x, `@cloudflare/vite-plugin`, Wrangler 4, TypeScript 5.9, pnpm workspaces.

**Execution guidance:**
- One commit per task where possible. Each phase ends with verification.
- Never `git add -A` — use explicit paths (there's a lot of file movement).
- After Phase 0 the rsvp package must pass typecheck + test + build before continuing.

---

## Phase 0 — Workspace Scaffolding

Move the existing single-app into `packages/rsvp/` and set up the pnpm workspace. The goal is to end this phase with an identical working app, just relocated.

### Task 0.1: Create workspace root files

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (workspace root)

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create workspace root package.json**

```json
{
  "private": true,
  "scripts": {
    "build": "pnpm --filter rsvp build && pnpm --filter frontend build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "format:check": "pnpm -r format:check",
    "dev:rsvp": "pnpm --filter rsvp dev",
    "dev:frontend": "pnpm --filter frontend dev"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "Add workspace root scaffolding"
```

### Task 0.2: Move source files into packages/rsvp/

**Files:**
- Move: `src/` → `packages/rsvp/src/`
- Move: `tests/` → `packages/rsvp/tests/`
- Move: `migrations/` → `packages/rsvp/migrations/`
- Move: `public/` → `packages/rsvp/public/`
- Move: `vite.config.ts` → `packages/rsvp/vite.config.ts`
- Move: `vite.config.node.ts` → `packages/rsvp/vite.config.node.ts`
- Move: `wrangler.toml` → `packages/rsvp/wrangler.toml`
- Move: root `package.json` → `packages/rsvp/package.json` (then create new root)

The root `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vitest.config.ts`, `eslint.config.js`, and `shared/` stay at the workspace root for now and get updated in the next task.

- [ ] **Step 1: Create packages/rsvp/ and move files**

```bash
mkdir -p packages/rsvp
git mv src packages/rsvp/src
git mv tests packages/rsvp/tests
git mv migrations packages/rsvp/migrations
git mv public packages/rsvp/public
git mv vite.config.ts packages/rsvp/vite.config.ts
git mv vite.config.node.ts packages/rsvp/vite.config.node.ts
git mv wrangler.toml packages/rsvp/wrangler.toml
```

- [ ] **Step 2: Move the app package.json to rsvp, update name and add exports**

Copy the current root `package.json` to `packages/rsvp/package.json`. The root `package.json` was already created in Task 0.1.

```bash
git mv package.json packages/rsvp/package.json
```

Edit `packages/rsvp/package.json`:
- Change `"name"` to `"rsvp"`
- Add `"exports"` field:

```json
{
  "name": "rsvp",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    "./api/public": "./dist/client-api/public.js"
  },
  "scripts": {
    "dev": "vite",
    "dev:node": "vite --config vite.config.node.ts",
    "build": "vite build",
    "start": "pnpm build && node --experimental-strip-types src/node-server.ts",
    "preview": "wrangler dev",
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --build",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:prod": "wrangler d1 migrations apply DB --remote",
    "db:console:local": "wrangler d1 execute DB --local --command",
    "db:console:prod": "wrangler d1 execute DB --remote --command"
  }
}
```

(Keep all dependencies and devDependencies unchanged.)

- [ ] **Step 3: Commit the move**

```bash
git add packages/rsvp/ package.json
git commit -m "Move source files into packages/rsvp/"
```

### Task 0.3: Update config files for workspace layout

**Files:**
- Modify: `packages/rsvp/vite.config.ts` — update `@shared` alias
- Modify: `packages/rsvp/vite.config.node.ts` — update `@shared` alias
- Move+Modify: `tsconfig.app.json` → `packages/rsvp/tsconfig.app.json` — update paths
- Move+Modify: `tsconfig.node.json` → `packages/rsvp/tsconfig.node.json` — update include
- Move+Modify: `tsconfig.json` → `packages/rsvp/tsconfig.json` — keep references
- Move+Modify: `vitest.config.ts` → `packages/rsvp/vitest.config.ts` — update alias and include paths
- Modify: `packages/rsvp/wrangler.toml` — update main path
- Modify: `eslint.config.js` — update for workspace layout

- [ ] **Step 1: Move tsconfig files into packages/rsvp/**

```bash
git mv tsconfig.json packages/rsvp/tsconfig.json
git mv tsconfig.app.json packages/rsvp/tsconfig.app.json
git mv tsconfig.node.json packages/rsvp/tsconfig.node.json
git mv vitest.config.ts packages/rsvp/vitest.config.ts
```

- [ ] **Step 2: Update packages/rsvp/vite.config.ts**

Change the `@shared` alias to resolve relative to the workspace root:

```ts
import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'
import { rscSsgPlugin } from './src/framework/ssg-plugin'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({
      entries: {
        client: './src/main.tsx',
        rsc: './src/worker.ts',
        ssr: './src/entry.ssr.tsx',
      },
      serverHandler: false,
    }),
    react(),
    rscSsgPlugin(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
```

- [ ] **Step 3: Update packages/rsvp/vite.config.node.ts**

```ts
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    rsc({
      entries: {
        client: './src/main.tsx',
        rsc: './src/entry.rsc.tsx',
        ssr: './src/entry.ssr.tsx',
      },
      serverHandler: false,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Update packages/rsvp/tsconfig.app.json**

Update the `paths` alias and `include` to reach `shared/` at the workspace root:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": [
      "vite/client",
      "@cloudflare/workers-types",
      "@vitejs/plugin-rsc/types"
    ],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": {
      "@shared/*": ["../../shared/*"]
    },
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src", "../../shared"]
}
```

- [ ] **Step 5: Update packages/rsvp/tsconfig.node.json**

Update the include path for the vite configs:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts", "vite.config.node.ts"]
}
```

- [ ] **Step 6: Update packages/rsvp/vitest.config.ts**

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
      '../../shared/**/*.test.ts',
    ],
    testTimeout: 60_000,
  },
})
```

- [ ] **Step 7: Update packages/rsvp/wrangler.toml**

No change needed — `main = "./src/worker.ts"` is relative to `wrangler.toml`'s location, which is now `packages/rsvp/`. Same for `assets.directory = "./dist/client"`.

- [ ] **Step 8: Update eslint.config.js for workspace layout**

Move to `packages/rsvp/eslint.config.js`:

```bash
git mv eslint.config.js packages/rsvp/eslint.config.js
```

Update the default-export override list to reflect files at the new location:

```js
  // Files that require default exports
  {
    files: ['src/worker.ts', 'vite.config.ts', 'vite.config.node.ts', 'vitest.config.ts'],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
```

(Paths are relative to the eslint config location, so these stay the same since eslint.config.js moved too.)

- [ ] **Step 9: Update test import paths**

The test files under `packages/rsvp/tests/e2e/` use relative imports like `../../src/server/lib/schema`. These are still correct since both `tests/` and `src/` moved together. But they reference `vite.config.node.ts` by path:

In `packages/rsvp/tests/e2e/rpc.roundtrip.test.ts` and `admin-auth.test.ts`, the `createServer` call uses `configFile: './vite.config.node.ts'`. This path is relative to CWD, which will be `packages/rsvp/` when running `pnpm --filter rsvp test`. No change needed.

- [ ] **Step 10: Move .wrangler state (if exists) and update .gitignore**

The `.wrangler/` directory (local D1 state) needs to be accessible from `packages/rsvp/`. Since wrangler runs from `packages/rsvp/`, it will create a new `.wrangler/` there.

```bash
# Re-initialize local D1 after the move
cd packages/rsvp && pnpm db:migrate:local
```

- [ ] **Step 11: Run pnpm install and verify**

```bash
pnpm install
cd packages/rsvp
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 12: Commit**

```bash
git add packages/rsvp/ eslint.config.js shared/
git commit -m "Update configs for workspace layout"
```

---

## Phase 1 — URL-Prefix Split

Split the single `/@rsc/` endpoint into `/@rsc-admin/` and `/@rsc-public/` with separate handlers. This is prerequisite for CORS (frontend needs to call `/@rsc-public/` cross-origin) and the stub generator (needs to identify which actions are public).

### Task 1.1: Move shared server code to src/server/shared/

**Files:**
- Create: `packages/rsvp/src/server/shared/` directory
- Create: `packages/rsvp/src/server/shared/lib/` directory
- Move: `src/server/context.ts` → `src/server/shared/context.ts`
- Move: `src/server/auth.ts` → `src/server/shared/auth.ts`
- Move: `src/server/lib/*` → `src/server/shared/lib/*`
- Modify: `src/server/admin/events.ts` — update imports
- Modify: `src/server/admin/groups.ts` — update imports
- Modify: `src/server/admin/guests.ts` — update imports
- Modify: `src/server/admin/import.ts` — update imports
- Modify: `src/server/admin/responses.ts` — update imports
- Modify: `src/server/public/rsvp.ts` — update imports

- [ ] **Step 1: Move files**

```bash
cd packages/rsvp
mkdir -p src/server/shared/lib
git mv src/server/context.ts src/server/shared/context.ts
git mv src/server/auth.ts src/server/shared/auth.ts
git mv src/server/lib/db.ts src/server/shared/lib/db.ts
git mv src/server/lib/db.test.ts src/server/shared/lib/db.test.ts
git mv src/server/lib/schema.ts src/server/shared/lib/schema.ts
git mv src/server/lib/fuzzy.ts src/server/shared/lib/fuzzy.ts
git mv src/server/lib/fuzzy.test.ts src/server/shared/lib/fuzzy.test.ts
rmdir src/server/lib
```

- [ ] **Step 2: Update imports in admin server functions**

In each file under `src/server/admin/` (`events.ts`, `groups.ts`, `guests.ts`, `import.ts`, `responses.ts`), update:

```ts
// Before:
import { getEnv } from '../context'
import { getDb, newId } from '../lib/db'

// After:
import { getEnv } from '../shared/context'
import { getDb, newId } from '../shared/lib/db'
```

Also update any imports of `nowIso`, `newInviteCode`, `aggregateLookupMatches`, schema types, etc. to use `../shared/lib/...` and `../shared/...` paths.

- [ ] **Step 3: Update imports in public server functions**

In `src/server/public/rsvp.ts`:

```ts
// Before:
import { getEnv } from '../context'
import { getDb, newId, nowIso } from '../lib/db'
import { aggregateLookupMatches } from '../lib/fuzzy'

// After:
import { getEnv } from '../shared/context'
import { getDb, newId, nowIso } from '../shared/lib/db'
import { aggregateLookupMatches } from '../shared/lib/fuzzy'
```

- [ ] **Step 4: Update imports in entry.rsc.tsx and worker.ts**

In `src/worker.ts`:

```ts
// Before:
import { verifyAccessJwt } from './server/auth'
import { runWithEnv } from './server/context'

// After:
import { verifyAccessJwt } from './server/shared/auth'
import { runWithEnv } from './server/shared/context'
```

- [ ] **Step 5: Update test import paths**

In `tests/e2e/feature-parity.test.ts` and `tests/e2e/rpc.roundtrip.test.ts`:

```ts
// Before:
import type { Database as DbSchema } from '../../src/server/lib/schema'

// After:
import type { Database as DbSchema } from '../../src/server/shared/lib/schema'
```

And the `loadRscModule` call for `runWithEnv`:

```ts
// Before:
'/src/server/context.ts'

// After:
'/src/server/shared/context.ts'
```

- [ ] **Step 6: Verify**

```bash
pnpm typecheck && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add packages/rsvp/src/server/ packages/rsvp/tests/
git commit -m "Move shared server code to src/server/shared/"
```

### Task 1.2: Parameterize rsc-client.ts

**Files:**
- Modify: `packages/rsvp/src/rsc-client.ts`
- Modify: `packages/rsvp/src/main.tsx`

- [ ] **Step 1: Update rsc-client.ts to accept a prefix parameter**

```ts
import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser'

export function setupServerCallback(prefix: string): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
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

- [ ] **Step 2: Update main.tsx to pass the admin prefix**

```ts
// Before:
setupServerCallback()

// After:
setupServerCallback('/@rsc-admin/')
```

The admin SPA calls admin actions via `/@rsc-admin/` (same-origin, no CORS).

- [ ] **Step 3: Verify**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/rsc-client.ts packages/rsvp/src/main.tsx
git commit -m "Parameterize rsc-client.ts with URL prefix"
```

### Task 1.3: Create per-prefix RSC entry handlers

**Files:**
- Create: `packages/rsvp/src/server/admin/rsc-entry.ts`
- Create: `packages/rsvp/src/server/public/rsc-entry.ts`

These replace the single `createRscHandler` from `entry.rsc.tsx`. Each handler globs its own directory's `"use server"` modules, builds an action ID allowlist, and handles requests for its prefix.

- [ ] **Step 1: Create packages/rsvp/src/server/admin/rsc-entry.ts**

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'
import { verifyAccessJwt } from '../shared/auth'

const PREFIX = '/@rsc-admin/'

// Eager glob registers every admin server-action module with plugin-rsc's
// server-references manifest. Without this, loadServerAction(id) throws.
const modules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true,
})

function collectActionIds(
  mods: Record<string, Record<string, unknown>>
): Set<string> {
  const ids = new Set<string>()
  for (const mod of Object.values(mods)) {
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}

const allowedIds = collectActionIds(modules)

export type Authorize = (request: Request) => Promise<Response | null>

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export async function handleAdminRsc(
  request: Request,
  opts: { aud: string; teamDomain: string }
): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response('Not found', { status: 404 })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const actionId = decodeURIComponent(url.pathname.slice(PREFIX.length))
  if (!allowedIds.has(actionId)) {
    return new Response('Forbidden', { status: 403 })
  }

  // Auth: Cloudflare Access JWT in prod, localhost bypass in dev
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    const ok = await verifyAccessJwt(request, opts)
    if (!ok) return new Response('Unauthorized', { status: 401 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const body = contentType.includes('multipart/form-data')
    ? await request.formData()
    : await request.text()

  const args = await decodeReply(body)
  const fn = await loadServerAction(actionId)
  const result = await fn(...args)

  const stream = renderToReadableStream(result)
  return new Response(stream, {
    headers: { 'content-type': 'text/x-component' },
  })
}

export { allowedIds as adminActionIds }
```

- [ ] **Step 2: Create packages/rsvp/src/server/public/rsc-entry.ts**

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'

const PREFIX = '/@rsc-public/'

const modules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true,
})

function collectActionIds(
  mods: Record<string, Record<string, unknown>>
): Set<string> {
  const ids = new Set<string>()
  for (const mod of Object.values(mods)) {
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}

const allowedIds = collectActionIds(modules)

export async function handlePublicRsc(
  request: Request
): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response('Not found', { status: 404 })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const actionId = decodeURIComponent(url.pathname.slice(PREFIX.length))
  if (!allowedIds.has(actionId)) {
    return new Response('Forbidden', { status: 403 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const body = contentType.includes('multipart/form-data')
    ? await request.formData()
    : await request.text()

  const args = await decodeReply(body)
  const fn = await loadServerAction(actionId)
  const result = await fn(...args)

  const stream = renderToReadableStream(result)
  return new Response(stream, {
    headers: { 'content-type': 'text/x-component' },
  })
}

export { allowedIds as publicActionIds }
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/rsvp/src/server/admin/rsc-entry.ts packages/rsvp/src/server/public/rsc-entry.ts
git commit -m "Create per-prefix RSC entry handlers"
```

### Task 1.4: Rewrite worker.ts as prefix dispatcher

**Files:**
- Modify: `packages/rsvp/src/worker.ts`
- Modify: `packages/rsvp/src/entry.rsc.tsx` — will be deleted after SSG is handled

- [ ] **Step 1: Rewrite worker.ts**

```ts
import { handleAdminRsc } from './server/admin/rsc-entry'
import { handlePublicRsc } from './server/public/rsc-entry'
import { runWithEnv } from './server/shared/context'

export { runWithEnv }
export { getStaticPaths, handleSsg } from './entry.rsc'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ACCESS_AUD: string
  ACCESS_TEAM_DOMAIN: string
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, rsc-action-id',
}

function withCors(response: Response): Response {
  const res = new Response(response.body, response)
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v)
  }
  return res
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight for public endpoint
    if (
      request.method === 'OPTIONS' &&
      url.pathname.startsWith('/@rsc-public/')
    ) {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    return runWithEnv(env, async () => {
      if (url.pathname.startsWith('/@rsc-admin/')) {
        return handleAdminRsc(request, {
          aud: env.ACCESS_AUD,
          teamDomain: env.ACCESS_TEAM_DOMAIN,
        })
      }

      if (url.pathname.startsWith('/@rsc-public/')) {
        const response = await handlePublicRsc(request)
        return withCors(response)
      }

      // Static assets; SPA fallback to root index.html
      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) return assetResponse

      const shellUrl = new URL('/', url)
      return env.ASSETS.fetch(new Request(shellUrl, request))
    })
  },
} satisfies ExportedHandler<Env>
```

Note: We temporarily keep the `entry.rsc` import for `getStaticPaths` and `handleSsg`. This gets cleaned up in Task 1.5.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/worker.ts
git commit -m "Rewrite worker.ts as prefix dispatcher with CORS"
```

### Task 1.5: Move SSG exports out of entry.rsc.tsx, then delete it

**Files:**
- Modify: `packages/rsvp/src/entry.rsc.tsx` — extract SSG, then delete
- Create or Modify: `packages/rsvp/src/framework/ssg-entry.tsx` — new home for SSG exports
- Modify: `packages/rsvp/src/worker.ts` — update SSG import
- Modify: `packages/rsvp/src/framework/ssg-plugin.ts` — no change (reads from built `dist/rsc/index.js`)

The SSG functions (`handleSsg`, `getStaticPaths`) currently live in `entry.rsc.tsx`. They need `renderToReadableStream` from `@vitejs/plugin-rsc/rsc` and the `Root` component. Move them to a dedicated file.

- [ ] **Step 1: Create packages/rsvp/src/framework/ssg-entry.tsx**

```tsx
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { Root } from '../root'

export { getStaticPaths } from '../root'

export async function handleSsg(request: Request): Promise<{
  html: ReadableStream<Uint8Array>
  rsc: ReadableStream<Uint8Array>
}> {
  const url = new URL(request.url)
  const rscPayload = { root: <Root url={url} /> }
  const rscStream = renderToReadableStream(rscPayload)
  const [rscStream1, rscStream2] = rscStream.tee()
  const ssr = await import.meta.viteRsc.loadModule<
    typeof import('../entry.ssr')
  >('ssr', 'index')
  const ssrResult = await ssr.renderHtml(rscStream1, { ssg: true })
  return { html: ssrResult.stream, rsc: rscStream2 }
}
```

- [ ] **Step 2: Update worker.ts to import from ssg-entry**

```ts
// Before:
export { getStaticPaths, handleSsg } from './entry.rsc'

// After:
export { getStaticPaths, handleSsg } from './framework/ssg-entry'
```

- [ ] **Step 3: Delete entry.rsc.tsx**

```bash
git rm packages/rsvp/src/entry.rsc.tsx
```

- [ ] **Step 4: Update vite.config.ts RSC entry**

The `rsc` entry in vite.config.ts currently points to `./src/worker.ts` (for cloudflare) — this is correct since the worker re-exports `handleSsg` and `getStaticPaths`. The `ssg-plugin.ts` imports from `dist/rsc/index.js` which is the built worker. No change needed.

- [ ] **Step 5: Update vite.config.node.ts**

The node config's `rsc` entry was `./src/entry.rsc.tsx`. It needs to point to a file that imports the RSC entries. Since the server action discovery is now in the per-prefix rsc-entry files, we need a shim:

Create `packages/rsvp/src/framework/rsc-dev-entry.ts`:

```ts
// Dev-mode RSC entry: imports both prefix handlers so their eager globs
// register server actions with plugin-rsc's manifest. Also re-exports
// SSG helpers for the ssg-plugin.
import '../server/admin/rsc-entry'
import '../server/public/rsc-entry'
export { getStaticPaths, handleSsg } from './ssg-entry'
```

Update `vite.config.node.ts`:

```ts
rsc({
  entries: {
    client: './src/main.tsx',
    rsc: './src/framework/rsc-dev-entry.ts',
    ssr: './src/entry.ssr.tsx',
  },
  serverHandler: false,
}),
```

- [ ] **Step 6: Verify**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add packages/rsvp/src/framework/ packages/rsvp/src/worker.ts packages/rsvp/vite.config.node.ts
git commit -m "Move SSG exports to framework/ssg-entry.tsx, delete entry.rsc.tsx"
```

### Task 1.6: Update tests for prefix split

**Files:**
- Modify: `packages/rsvp/tests/e2e/rpc.roundtrip.test.ts`
- Modify: `packages/rsvp/tests/e2e/admin-auth.test.ts`

The tests currently use `/@rsc/` and import `createRscHandler` from `entry.rsc.tsx`. They need to use the new prefix handlers.

- [ ] **Step 1: Update rpc.roundtrip.test.ts**

Key changes:
- Import handlers via RSC env runner from the new locations
- Use `/@rsc-admin/` and `/@rsc-public/` prefixes
- Wire both handlers into the middleware

```ts
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

  const adminEntry = await loadRscModule<
    typeof import('../../src/server/admin/rsc-entry')
  >('/src/server/admin/rsc-entry.ts')
  const publicEntry = await loadRscModule<
    typeof import('../../src/server/public/rsc-entry')
  >('/src/server/public/rsc-entry.ts')

  const ctx = await loadRscModule<
    typeof import('../../src/server/shared/context')
  >('/src/server/shared/context.ts')
  const runWithEnv = ctx.runWithEnv

  const listener = createRequestListener(async (request) => {
    const url = new URL(request.url)
    try {
      if (url.pathname.startsWith('/@rsc-admin/')) {
        return await runWithEnv({ DB: localKyselyDb }, () =>
          adminEntry.handleAdminRsc(request, { aud: '', teamDomain: '' })
        )
      }
      if (url.pathname.startsWith('/@rsc-public/')) {
        return await runWithEnv({ DB: localKyselyDb }, () =>
          publicEntry.handlePublicRsc(request)
        )
      }
      return new Response('not found', { status: 404 })
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

test('admin RPC (localhost bypass) returns 200', async () => {
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
```

- [ ] **Step 2: Update admin-auth.test.ts**

```ts
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
  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await createServer({
    configFile: './vite.config.node.ts',
    server: { port, strictPort: false, host: '127.0.0.1' },
    appType: 'custom',
  })
  await server.listen()

  const adminEntry = await loadRscModule<
    typeof import('../../src/server/admin/rsc-entry')
  >('/src/server/admin/rsc-entry.ts')
  handleAdminRsc = adminEntry.handleAdminRsc

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

test('admin action with non-localhost triggers auth (returns 401 with no JWT)', async () => {
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
  // Will fail on decodeReply (no body) but NOT on auth — proving bypass works
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
```

- [ ] **Step 3: Update feature-parity.test.ts import path**

Only the schema import and context import paths need updating (already done in Task 1.1 step 5). Verify no other references to `entry.rsc.tsx` or `/@rsc/` remain.

- [ ] **Step 4: Verify**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/rsvp/tests/
git commit -m "Update tests for /@rsc-admin/ and /@rsc-public/ prefix split"
```

### Task 1.7: Update node-server.ts for prefix dispatch

**Files:**
- Modify: `packages/rsvp/src/node-server.ts`

- [ ] **Step 1: Update node-server.ts**

The node server imports from `dist/rsc/index.js`. After the build, the worker re-exports `runWithEnv` and the SSG helpers. But the per-prefix handlers are also bundled in via the worker's imports. We need to update the routing:

```ts
// Replace the single /@rsc/ handler with prefix dispatch:

// Before:
// if (url.pathname.startsWith('/@rsc/')) return rscHandler(request)

// After:
// The built dist/rsc/index.js exports the default worker handler.
// Import and use its fetch method directly, or import the individual handlers.
```

Since the built `dist/rsc/index.js` includes the default export (the worker's fetch handler), the simplest approach is to use it directly. But the worker expects `env.ASSETS` which doesn't exist in Node. Instead, import the handler functions:

```ts
import { readdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { createRequestListener } from '@remix-run/node-fetch-server'
import Database from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
// @ts-expect-error built artifact, no types
import rscBundle from '../dist/rsc/index.js'
import type { Database as DbSchema } from './server/shared/lib/schema.ts'

const { runWithEnv } = rscBundle
// The default export is the worker handler; we need the individual handlers.
// They're not separately exported, so we use the worker's fetch method
// with a stub env that handles ASSETS locally.

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

// Use the built worker's default export fetch handler with a stubbed ASSETS
const workerHandler = rscBundle.default

const listener = createRequestListener(async (request) => {
  // Create a fake ASSETS fetcher that serves from dist/client/
  const fakeAssets = {
    async fetch(req: Request) {
      const url = new URL(req.url)
      const file = await serveStatic(url.pathname)
      return file ?? new Response('Not found', { status: 404 })
    },
  }
  const env = {
    DB: localKyselyDb,
    ASSETS: fakeAssets,
    ACCESS_AUD: '',
    ACCESS_TEAM_DOMAIN: '',
  }
  return workerHandler.fetch(request, env)
})

createServer(listener).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`)
})
```

- [ ] **Step 2: Verify**

```bash
pnpm build && node --experimental-strip-types src/node-server.ts
```

Visit `http://localhost:3000` and `http://localhost:3000/admin/` to verify.

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/node-server.ts
git commit -m "Update node-server.ts for prefix dispatch"
```

---

## Phase 2 — Client Stub Generator Plugin

### Task 2.1: Write the stub-generator vite plugin

**Files:**
- Create: `packages/rsvp/src/framework/stub-generator-plugin.ts`

This plugin runs after plugin-rsc's build completes. It reads `manager.serverReferenceMetaMap`, filters for public actions (those whose `importId` contains `/server/public/`), and generates a standalone JS module with `createServerReference` stubs.

- [ ] **Step 1: Create the plugin**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { getPluginApi } from '@vitejs/plugin-rsc'
import type { Plugin, ResolvedConfig } from 'vite'

interface ServerReferenceMeta {
  importId: string
  referenceKey: string
  exportNames: string[]
}

export function stubGeneratorPlugin(): Plugin {
  let manager: { serverReferenceMetaMap: Record<string, ServerReferenceMeta> }
  let outDir: string

  return {
    name: 'rsvp-stub-generator',
    apply: 'build',
    enforce: 'post',

    configResolved(config: ResolvedConfig) {
      const api = getPluginApi(config)
      if (!api) {
        throw new Error(
          'rsvp-stub-generator: @vitejs/plugin-rsc not found — is it registered?'
        )
      }
      manager = api.manager
      outDir = config.build.outDir
    },

    closeBundle: {
      order: 'post' as const,
      async handler() {
        const publicEntries = Object.values(
          manager.serverReferenceMetaMap
        ).filter((meta) => meta.importId.includes('/server/public/'))

        if (publicEntries.length === 0) {
          console.warn(
            '[rsvp-stub-generator] No public server references found'
          )
          return
        }

        const lines: string[] = [
          "import { createServerReference, callServer } from '@vitejs/plugin-rsc/browser'",
          '',
        ]

        for (const meta of publicEntries) {
          for (const name of meta.exportNames) {
            const fullId = `${meta.referenceKey}#${name}`
            const safeName = name === 'default' ? '_default' : name
            lines.push(
              `export const ${safeName} = /* @__PURE__ */ createServerReference(${JSON.stringify(fullId)}, callServer, undefined, undefined, ${JSON.stringify(name)})`
            )
          }
        }

        lines.push('')

        // Resolve output relative to the rsvp package root (one level up from outDir which is dist/)
        const pkgRoot = path.resolve(outDir, '..')
        const apiDir = path.join(pkgRoot, 'dist', 'client-api')
        await fs.promises.mkdir(apiDir, { recursive: true })
        await fs.promises.writeFile(
          path.join(apiDir, 'public.js'),
          lines.join('\n')
        )

        console.log(
          `[rsvp-stub-generator] Generated ${publicEntries.reduce((n, m) => n + m.exportNames.length, 0)} stubs → dist/client-api/public.js`
        )
      },
    },
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/rsvp/src/framework/stub-generator-plugin.ts
git commit -m "Add stub-generator vite plugin"
```

### Task 2.2: Wire plugin into vite config and add type definitions

**Files:**
- Modify: `packages/rsvp/vite.config.ts`
- Create: `packages/rsvp/src/client-api/public.d.ts`
- Modify: `packages/rsvp/eslint.config.js` — allow default export in plugin file

- [ ] **Step 1: Add plugin to vite config**

```ts
import { fileURLToPath, URL } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'
import { rscSsgPlugin } from './src/framework/ssg-plugin'
import { stubGeneratorPlugin } from './src/framework/stub-generator-plugin'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({
      entries: {
        client: './src/main.tsx',
        rsc: './src/worker.ts',
        ssr: './src/entry.ssr.tsx',
      },
      serverHandler: false,
    }),
    react(),
    rscSsgPlugin(),
    stubGeneratorPlugin(),
  ],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
})
```

- [ ] **Step 2: Create hand-written type definitions**

Create `packages/rsvp/src/client-api/public.d.ts` mirroring the public function signatures from `src/server/public/rsvp.ts`:

```ts
import type {
  LookupResponse,
  RsvpGroupResponse,
  RsvpSubmission,
} from '@shared/schemas/rsvp'

export declare function lookupGuests(query: string): Promise<LookupResponse>
export declare function getRsvpGroup(code: string): Promise<RsvpGroupResponse>
export declare function submitRsvp(
  code: string,
  submission: RsvpSubmission
): Promise<{ ok: true; respondedAt: string }>
```

- [ ] **Step 3: Update package.json exports to include types**

```json
{
  "exports": {
    "./api/public": {
      "types": "./src/client-api/public.d.ts",
      "default": "./dist/client-api/public.js"
    }
  }
}
```

- [ ] **Step 4: Build and verify stubs are generated**

```bash
pnpm build
cat dist/client-api/public.js
```

Expected: a JS file with `createServerReference` calls for `lookupGuests`, `getRsvpGroup`, and `submitRsvp`.

- [ ] **Step 5: Commit**

```bash
git add packages/rsvp/vite.config.ts packages/rsvp/src/client-api/ packages/rsvp/package.json
git commit -m "Wire stub-generator plugin into build, add public API types"
```

---

## Phase 3 — Frontend Package

### Task 3.1: Create frontend package skeleton

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/tsconfig.app.json`
- Create: `packages/frontend/tsconfig.node.json`
- Create: `packages/frontend/vite.config.ts`
- Create: `packages/frontend/index.html`

- [ ] **Step 1: Create packages/frontend/package.json**

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --build",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.55.0",
    "react-router-dom": "^7.2.0",
    "rsvp": "workspace:*",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "@vitejs/plugin-rsc": "~0.5.24",
    "typescript": "~5.9.3",
    "vite": "^8.0.8"
  }
}
```

Note: `@vitejs/plugin-rsc` is a devDependency because the browser runtime (`@vitejs/plugin-rsc/browser`) is needed at runtime by the stubs. Check if it needs to be a regular dependency — if the stubs import from it, it must be available at build time for the frontend.

- [ ] **Step 2: Create packages/frontend/vite.config.ts**

```ts
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 3: Create packages/frontend/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Kavari-Searls Wedding</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create tsconfig files**

`packages/frontend/tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`packages/frontend/tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": {
      "@shared/*": ["../../shared/*"]
    },
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src", "../../shared"]
}
```

`packages/frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/
git commit -m "Create frontend package skeleton"
```

### Task 3.2: Create frontend app entry and rsc-client

**Files:**
- Create: `packages/frontend/src/main.tsx`
- Create: `packages/frontend/src/rsc-client.ts`
- Create: `packages/frontend/src/App.tsx`
- Copy: relevant CSS files from rsvp

- [ ] **Step 1: Create packages/frontend/src/rsc-client.ts**

```ts
import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser'

export function setupServerCallback(endpoint: string): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
    const response = fetch(`${endpoint}${encodeURIComponent(id)}`, {
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

- [ ] **Step 2: Create packages/frontend/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { App } from './App'
import { setupServerCallback } from './rsc-client'

const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8787'
setupServerCallback(`${backendUrl}/@rsc-public/`)

const router = createBrowserRouter([
  { path: '/', Component: App },
  {
    path: '/rsvp/:code',
    lazy: async () => ({
      Component: (await import('./routes/RsvpFull')).RsvpFull,
    }),
  },
  { path: '*', Component: App },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

Note: Uses `createRoot` (not `hydrateRoot`) since the frontend is a pure SPA, not prerendered.

- [ ] **Step 3: Create packages/frontend/src/App.tsx**

Copy `packages/rsvp/src/App.tsx` to `packages/frontend/src/App.tsx`. Update any import paths if components are co-located. For now, copy the components the App needs:

```bash
cp -r packages/rsvp/src/App.tsx packages/frontend/src/App.tsx
cp -r packages/rsvp/src/App.css packages/frontend/src/App.css
cp -r packages/rsvp/src/App.module.css packages/frontend/src/App.module.css
cp -r packages/rsvp/src/index.css packages/frontend/src/index.css
cp -r packages/rsvp/src/typography.module.css packages/frontend/src/typography.module.css
```

- [ ] **Step 4: Copy route and component files the frontend needs**

```bash
mkdir -p packages/frontend/src/routes
mkdir -p packages/frontend/src/components/ui
mkdir -p packages/frontend/src/lib
cp packages/rsvp/src/routes/RsvpFull.tsx packages/frontend/src/routes/
cp packages/rsvp/src/routes/RsvpFull.module.css packages/frontend/src/routes/
cp packages/rsvp/src/routes/RsvpLookup.tsx packages/frontend/src/routes/
cp packages/rsvp/src/routes/RsvpLookup.module.css packages/frontend/src/routes/
cp packages/rsvp/src/routes/EventCardEditor.tsx packages/frontend/src/routes/
cp packages/rsvp/src/lib/rsvpFormState.ts packages/frontend/src/lib/
cp packages/rsvp/src/components/BackgroundLayout.tsx packages/frontend/src/components/
cp packages/rsvp/src/components/BackgroundLayout.module.css packages/frontend/src/components/
cp packages/rsvp/src/components/Section.tsx packages/frontend/src/components/
cp packages/rsvp/src/components/Section.module.css packages/frontend/src/components/
cp packages/rsvp/src/components/AnchorContext.tsx packages/frontend/src/components/
```

Copy any UI components that the routes import (Button, ErrorMessage, LoadingIndicator, etc.). Check the imports in `RsvpFull.tsx`, `RsvpLookup.tsx`, and `EventCardEditor.tsx` to determine which components are needed.

- [ ] **Step 5: Update server function imports in routes**

In the copied frontend route files, change imports from relative server paths to the rsvp package:

```ts
// Before (in rsvp package):
import { lookupGuests } from '../server/public/rsvp'

// After (in frontend package):
import { lookupGuests } from 'rsvp/api/public'
```

Do this for all three public functions used in the routes: `lookupGuests`, `getRsvpGroup`, `submitRsvp`.

- [ ] **Step 6: Create .env for dev**

Create `packages/frontend/.env`:

```
VITE_BACKEND_URL=http://localhost:8787
```

- [ ] **Step 7: Verify typecheck**

```bash
pnpm install
pnpm --filter frontend typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/
git commit -m "Create frontend app with rsvp/api/public integration"
```

### Task 3.3: End-to-end round-trip verification

- [ ] **Step 1: Build rsvp (generates stubs)**

```bash
pnpm --filter rsvp build
```

Verify `packages/rsvp/dist/client-api/public.js` exists and contains `createServerReference` calls.

- [ ] **Step 2: Build frontend**

```bash
pnpm --filter frontend build
```

Verify `packages/frontend/dist/` contains static HTML/JS.

- [ ] **Step 3: Start rsvp worker**

```bash
cd packages/rsvp && pnpm preview
```

This starts wrangler dev on port 8787.

- [ ] **Step 4: Serve frontend**

In another terminal:

```bash
cd packages/frontend && pnpm preview
```

This starts vite preview on port 4173.

- [ ] **Step 5: Manual test**

1. Open `http://localhost:4173` in browser
2. The frontend loads (static SPA)
3. Search for a guest name in the RSVP lookup
4. Browser devtools Network tab should show a POST to `http://localhost:8787/@rsc-public/<id>`
5. Response should be `200` with `content-type: text/x-component`
6. Response should have CORS headers (`access-control-allow-origin: *`)
7. Results should render in the UI

- [ ] **Step 6: Verify CORS preflight**

```bash
curl -X OPTIONS http://localhost:8787/@rsc-public/test \
  -H "Origin: http://localhost:4173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type, rsc-action-id" \
  -v
```

Expected: `204` response with `access-control-allow-origin: *` header.

---

## Phase 4 — Cleanup

### Task 4.1: Remove duplicated public routes from rsvp

**Files:**
- Delete: `packages/rsvp/src/routes/RsvpFull.tsx` and `.module.css`
- Delete: `packages/rsvp/src/routes/RsvpLookup.tsx` and `.module.css`
- Delete: `packages/rsvp/src/routes/EventCardEditor.tsx`
- Modify: `packages/rsvp/src/main.tsx` — remove public route entries
- Modify: `packages/rsvp/src/App.tsx` — remove RsvpLookup reference
- Modify: `packages/rsvp/src/root.tsx` — remove public App rendering (admin only)

Only do this if the public routes are fully functional in the frontend package. The rsvp package becomes admin-only.

- [ ] **Step 1: Update rsvp's main.tsx to admin-only routes**

```tsx
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { setupServerCallback } from './rsc-client'
import './index.css'

setupServerCallback('/@rsc-admin/')

const router = createBrowserRouter([
  {
    path: '/admin/*',
    lazy: async () => ({
      Component: (await import('./admin/AdminApp')).AdminApp,
    }),
  },
])

async function bootstrap() {
  const pathname = window.location.pathname
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    await import('./admin/AdminApp')
  }
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}

bootstrap()
```

- [ ] **Step 2: Update root.tsx to admin-only**

```tsx
import { AdminRoot } from './admin/AdminRoot'

export function Root({ url }: { url: URL }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>Admin · RSVP</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <div id="root">
          <AdminRoot location={url.pathname + url.search} />
        </div>
      </body>
    </html>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export async function getStaticPaths(): Promise<string[]> {
  return ['/admin/', '/admin/groups/', '/admin/import/', '/admin/events/']
}
```

- [ ] **Step 3: Delete public route files from rsvp**

```bash
cd packages/rsvp
git rm src/routes/RsvpFull.tsx src/routes/RsvpFull.module.css
git rm src/routes/RsvpLookup.tsx src/routes/RsvpLookup.module.css
git rm src/routes/EventCardEditor.tsx
git rm src/App.tsx src/App.css src/App.module.css
git rm src/lib/rsvpFormState.ts
```

- [ ] **Step 4: Remove components only used by public routes**

Check which components in `src/components/` are only used by the deleted public routes. Remove them from the rsvp package. Keep components used by admin routes.

- [ ] **Step 5: Verify**

```bash
pnpm --filter rsvp typecheck && pnpm --filter rsvp test && pnpm --filter rsvp build
pnpm --filter frontend typecheck && pnpm --filter frontend build
```

- [ ] **Step 6: Commit**

```bash
git add packages/rsvp/ packages/frontend/
git commit -m "Remove public routes from rsvp, admin-only package"
```

### Task 4.2: Update CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml` (or equivalent)

- [ ] **Step 1: Update CI to build workspace**

The CI should:
1. `pnpm install` at workspace root
2. `pnpm -r typecheck`
3. `pnpm -r lint`
4. `pnpm -r format:check`
5. `pnpm --filter rsvp db:migrate:local` (for tests)
6. `pnpm --filter rsvp test`
7. `pnpm --filter rsvp build` (must come before frontend)
8. `pnpm --filter frontend build`

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "Update CI for workspace build"
```

---

## Verification

After each phase:
- `pnpm -r typecheck` — all packages compile
- `pnpm --filter rsvp test` — server tests pass
- `pnpm --filter rsvp build` — worker + admin SPA + stubs generated

Final verification (Phase 3):
- Start rsvp worker locally (`pnpm --filter rsvp preview`)
- Serve frontend separately (`pnpm --filter frontend preview`)
- Confirm cross-origin RSC round-trip works (guest lookup, RSVP submission)
- Confirm CORS headers on `/@rsc-public/` responses
- Confirm `/@rsc-admin/` rejects requests from the frontend origin (no CORS headers = browser blocks)
