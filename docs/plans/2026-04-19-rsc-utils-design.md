# rsc-utils Extraction — Design

**Goal:** Extract the duplicated RSC framework code from `packages/rsvp/` and `packages/frontend/` into a new workspace package `packages/rsc-utils/` that provides a small, modular Vite plugin library for building RSC apps. An app opts in to what it needs: server functions (RPC), static prerendering (SSG), or just consuming stubs from another package.

**Non-goal:** A full framework. The user's worker still owns routing; per-namespace runtime behavior (CORS, etc.) stays close to the code it applies to.

---

## Public Surface

### Three Vite plugins

| Plugin                    | Purpose                                                                                                                  | Internal `name`       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `rscFunctions(config)`    | Everything related to RSC server functions: generates a virtual modules map per namespace, optionally emits client stubs | `rsc-utils:functions` |
| `rscSsg({ staticPaths })` | Provides virtual SSG + SSR entries; orchestrates static prerender during build                                           | `rsc-utils:ssg`       |
| `rscBrowser()`            | Zero-config compatibility shim so a plain-Vite SPA can consume stubs that import `@vitejs/plugin-rsc/browser`            | `rsc-utils:browser`   |

### Two runtime helpers

| Helper                          | Exported from                 | Purpose                                                                                          |
| ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `createRscHandlers(config)`     | `rsc-utils/functions/server`  | Builds all per-namespace request handlers from the shared config; returns `{ handle, handlers }` |
| `setupServerCallback(endpoint)` | `rsc-utils/functions/browser` | Registers the browser-side RSC action callback for a given endpoint prefix                       |

### Shared config (used by plugin + runtime)

```ts
import type { FunctionsConfig } from 'rsc-utils'

export const functionsConfig = {
  namespaces: [
    {
      name: 'public',
      glob: 'src/server/public/*.ts',
      buildStub: true,
      cors: { origin: '*' },
    },
    { name: 'admin', glob: 'src/server/admin/*.ts' },
  ],
} satisfies FunctionsConfig
```

**Per-namespace options:**

- `name: string` — drives prefix `/@rsc-${name}/` and stub filename `dist/client-api/${name}.js`
- `glob: string` — project-root-relative glob for this namespace's server-function modules (e.g. `'src/server/public/*.ts'`, matching Vite's `import.meta.glob` with a leading `/`)
- `buildStub?: boolean` — default `false`; set `true` to emit `dist/client-api/${name}.js` for external consumers
- `cors?: CorsOptions` — per-namespace CORS; omitted means no CORS handling

**`CorsOptions` shape:**

```ts
type CorsOptions = {
  origin: string | string[] // required; e.g. '*' or a specific origin
  methods?: string[] // default ['POST', 'OPTIONS']
  headers?: string[] // default ['content-type', 'rsc-action-id']
}
```

**Design rule:** The plugin has zero hardcoded behavior that differs between namespaces. Admin and public are structurally identical from the library's perspective — they differ only in the config object.

---

## Package Layout

```
packages/rsc-utils/
├── package.json                           # name: "rsc-utils"
├── tsconfig.json
└── src/
    ├── index.ts                           # re-exports plugin factories + types
    ├── types.ts                           # FunctionsConfig, NamespaceConfig, CorsOptions
    └── plugins/
        ├── functions/
        │   ├── index.ts                   # rscFunctions() factory
        │   ├── stub-generator.ts          # internal: filters serverReferenceMetaMap, emits client stubs
        │   ├── modules-virtual.ts         # internal: generates virtual:rsc-utils/functions/modules
        │   ├── server.ts                  # createRscHandlers (runtime)
        │   └── browser.ts                 # setupServerCallback (runtime)
        ├── ssg/
        │   ├── index.ts                   # rscSsg() factory
        │   ├── build-orchestrator.ts      # internal: renderStatic in buildApp hook
        │   ├── ssg-entry.ts               # virtual:rsc-utils/ssg-entry source
        │   └── ssr-entry.ts               # virtual ssr entry source (internal renderHtml)
        └── browser-compat/
            └── index.ts                   # rscBrowser() factory
```

### Package exports

```json
{
  "name": "rsc-utils",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./functions/server": "./dist/plugins/functions/server.js",
    "./functions/browser": "./dist/plugins/functions/browser.js"
  }
}
```

Plugin factories are re-exported from `.`; runtime helpers live at sub-paths that mirror the plugin directory they belong to.

---

## Plugin Behavior

### `rscFunctions(config)`

Input: `FunctionsConfig` (the shared config).

Build-time behavior:

1. **Generates a virtual module** `virtual:rsc-utils/functions/modules` containing one eager glob per namespace:
   ```js
   export const modules = {
     public: import.meta.glob('/src/server/public/*.ts', { eager: true }),
     admin: import.meta.glob('/src/server/admin/*.ts', { eager: true }),
   }
   ```
2. **Emits client stubs** via `closeBundle` hook (post-order). For each namespace where `buildStub === true`:
   - Reads `@vitejs/plugin-rsc`'s `serverReferenceMetaMap` via `getPluginApi(config).manager`
   - Filters entries whose `importId` matches the namespace's glob
   - Writes `dist/client-api/${name}.js` with `createServerReference(...)` calls for each exported action

### `rscSsg({ staticPaths })`

Input:

- `staticPaths: string[]` — routes to prerender (e.g. `['/admin/', '/admin/groups/']`)

Build-time behavior:

1. **Declares the SSR entry** to `@vitejs/plugin-rsc` via Vite config-resolved hook, pointing at an internal virtual SSR module that uses React's `prerender` (SSG only — no try/catch, errors fail the build).
2. **Provides `virtual:rsc-utils/ssg-entry`** exporting `getStaticPaths(): string[]` that returns the configured array.
3. **Orchestrates static generation** in `buildApp` hook: imports the built RSC entry, iterates `getStaticPaths()`, writes HTML + `.rsc` files under `config.environments.client.build.outDir`.

The user owns a small `src/ssg-entry.tsx` file that wires the `Root` component to the render pipeline using `createSsgHandler` from `rsc-utils/ssg`:

```ts
// src/ssg-entry.tsx
import { createSsgHandler } from 'rsc-utils/ssg'
import { Root } from './root'
export const { handleSsg } = createSsgHandler({ Root })
```

Their worker/RSC entry re-exports the hooks so they survive into the built RSC bundle:

```ts
export { getStaticPaths } from 'virtual:rsc-utils/ssg-entry'
export { handleSsg } from './ssg-entry'
```

### `rscBrowser()`

Zero-config. Exports two internal sub-plugins composed into one:

1. **Stub `virtual:vite-rsc/client-references`** — responds to the virtual module id with `export default {}` so `@vitejs/plugin-rsc/browser` imports resolve in a non-plugin-rsc app.
2. **Rewrite `__webpack_require__`** inside `@vitejs/plugin-rsc` and `react-server-dom-*` transforms: replace `__webpack_require__.u` → `({}).u` and `__webpack_require__` → `__vite_rsc_require__`, matching what plugin-rsc's runtime expects.

No options needed today. Future options (e.g. custom runtime override) can be added non-breakingly.

---

## Runtime Behavior

### `createRscHandlers(config)`

```ts
import { modules } from 'virtual:rsc-utils/functions/modules'

export function createRscHandlers(config: FunctionsConfig): {
  handle: (req: Request) => Promise<Response | null>
  handlers: Record<string, (req: Request) => Promise<Response>>
}
```

For each namespace in `config.namespaces`:

- Builds a handler using `modules[name]` (from the virtual globs module), prefix `/@rsc-${name}/`, and `cors` if present.
- Handler validates prefix + method + action ID allowlist (collected from `$$id` markers on exported functions), decodes the reply, runs the action via `loadServerAction`, streams the result back as `text/x-component`.
- If `cors` is configured, the handler also answers `OPTIONS` preflight and adds CORS headers to responses.

`handle(request)` dispatches by prefix; returns `null` when no namespace matches (caller then proceeds with its own routing). `handlers[name]` is exposed for apps that want finer-grained composition.

### `setupServerCallback(endpoint)`

Identical to the current implementation. Registers a `setServerCallback` from `@vitejs/plugin-rsc/browser` that POSTs encoded args to `${endpoint}${encodeURIComponent(actionId)}` and returns the RSC-parsed response.

---

## App-side Changes

### `packages/rsvp/`

**Deleted:**

- `src/framework/` (entire directory)
- `src/entry.ssr.tsx`
- `src/rsc-client.ts`
- `src/server/admin/rsc-entry.ts`
- `src/server/public/rsc-entry.ts`

**Added:**

- `src/rsc-functions.ts` — the shared config object

**`src/root.tsx`** — drops `getStaticPaths` export; keeps the React `Root` component (now imported directly by `src/ssg-entry.tsx`).

**`vite.config.ts`** — becomes:

```ts
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { rscFunctions, rscSsg } from 'rsc-utils'
import { functionsConfig } from './src/rsc-functions'

export default defineConfig({
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'rsc' },
      configPath: './wrangler.toml',
    }),
    rsc({
      entries: { client: './src/main.tsx', rsc: './src/worker.ts' },
      serverHandler: false,
    }),
    react(),
    rscFunctions(functionsConfig),
    rscSsg({
      staticPaths: [
        '/admin/',
        '/admin/groups/',
        '/admin/import/',
        '/admin/events/',
      ],
    }),
  ],
})
```

Note: no `ssr` entry in `rsc({ entries: {...} })` — `rscSsg` provides it.

**`src/worker.ts`** — imports runtime helpers, keeps worker routing explicit:

```ts
import { createRscHandlers } from 'rsc-utils/functions/server'
import { functionsConfig } from './rsc-functions'
import { runWithEnv } from './server/shared/context'

export { runWithEnv }
export { getStaticPaths, handleSsg } from 'virtual:rsc-utils/ssg-entry'

const { handle } = createRscHandlers(functionsConfig)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const rscResponse = await handle(request)
      if (rscResponse) return rscResponse

      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) return assetResponse

      return env.ASSETS.fetch(new Request(new URL('/', request.url), request))
    })
  },
} satisfies ExportedHandler<Env>
```

**`src/main.tsx`** — uses the runtime import:

```ts
import { setupServerCallback } from 'rsc-utils/functions/browser'
setupServerCallback('/@rsc-admin/')
```

### `packages/frontend/`

**`vite.config.ts`** — loses the entire `rscBrowserCompat` function. Becomes:

```ts
import { rscBrowser } from 'rsc-utils'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [rscBrowser(), react()],
  // ... resolve aliases, server port unchanged
})
```

**`src/rsc-client.ts`** — deleted; `src/main.tsx` imports `setupServerCallback` from `rsc-utils/functions/browser`.

---

## Open Points for the Plan Phase

These are deliberately left for the implementation plan (writing-plans) to resolve:

1. How to declare the SSR entry virtually to `@vitejs/plugin-rsc` from within `rscSsg` (config hook order, naming).
2. Whether the `virtual:rsc-utils/functions/modules` path needs plugin-rsc coordination so the globs resolve correctly in the `rsc` environment.
3. Whether `tsconfig` paths in each app need updating for the `virtual:rsc-utils/*` module type declarations.
4. Test strategy for the new package (the current apps have typecheck + e2e; unit tests for the plugins are a new addition).

---

## Success Criteria

- Both `packages/rsvp/` and `packages/frontend/` build and pass existing tests after migration.
- `rsvp` loses its `src/framework/`, `src/entry.ssr.tsx`, `src/rsc-client.ts`, and both namespace `rsc-entry.ts` files.
- `frontend` loses the inline `rscBrowserCompat()` function.
- `rsvp/vite.config.ts` is shorter and reads as declarative plugin registration.
- The shared config (`rsc-functions.ts`) is the single source of truth for namespaces.
- Adding a new namespace requires: one entry in the shared config, and a new `src/server/<name>/*.ts` folder — nothing else.
