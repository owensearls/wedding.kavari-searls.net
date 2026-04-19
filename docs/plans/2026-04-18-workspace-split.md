# Workspace Split + `@wedding/cloudflare` Host Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-package repo into a pnpm workspace with four packages (`@wedding/shared`, `@wedding/public`, `@wedding/admin`, `@wedding/cloudflare`) so each domain lives in its own source tree, auth isolation moves from an in-app allowlist to a build-level separation of RSC graphs, and prod still ships as one Cloudflare Worker.

**Architecture:**
- **Leaves** (`shared`, `public`, `admin`) are pure-source packages — no `dist/`, no build scripts. They export `.ts` source via the `"exports"` field. Each workspace consumer imports via the package name; Vite transpiles on the fly.
- **Host** (`@wedding/cloudflare`) owns all build orchestration, wrangler config, and the runtime dispatcher Worker. For prod: runs two independent `vite build`s (one per leaf) so each gets its own RSC graph, then builds a tiny dispatcher Worker that path-routes `/@rsc-admin/*` → admin bundle, `/@rsc-public/*` → public bundle, everything else → static assets. For dev: runs ONE Vite server whose RSC entry globs both leaves' server actions (auth bypass via hostname check), serving both `/` and `/admin/*` on a single port.
- **Auth** becomes structural: the admin prod bundle only knows admin actions, so any request reaching it for auth-evasion is impossible — there are no public action IDs to target. Cloudflare Access gates `/admin*` + `/@rsc-admin*` at the edge (one dashboard field edit); the admin sub-worker retains `verifyAccessJwt` as defense-in-depth with a localhost bypass.

**Tech Stack:** pnpm workspaces (`workspace:*`), Node 22, Vite 8, `@vitejs/plugin-rsc`, `@cloudflare/vite-plugin`, Wrangler 4, React 19, Kysely, D1, Vitest, TypeScript 5.9 with `moduleResolution: "bundler"`.

**Execution guidance:**
- This is a large restructure. Make one commit per task where possible. If a task's intermediate state leaves the build broken, that's acceptable — the end of each phase should leave tests passing. Phase boundaries are verification checkpoints.
- Never rely on `git add -A` / `git add .`. Add explicit paths — the move-heavy nature of this work makes sweeping adds dangerous.
- Run `pnpm test` after each phase. Full green before moving to the next.
- Keep the dev server running in a second terminal if you want immediate UI feedback; the active probe target is `http://localhost:5173/admin/groups`.

---

## File Structure (target)

```
/                                   workspace root
├── package.json                    workspace root: scripts, devDeps, pnpm config
├── pnpm-workspace.yaml             declares packages/* + root
├── tsconfig.json                   project references only
├── eslint.config.js                repo-wide lint config (unchanged)
├── .prettierrc / .prettierignore   unchanged
├── migrations/                     D1 migrations — stays at root (shared source of truth)
├── docs/                           docs (this plan lives here)
├── tests/e2e/                      end-to-end tests — stay at root
└── packages/
    ├── shared/                     @wedding/shared — pure source
    │   ├── package.json            { "exports": { ".": "./src/index.ts", "./schemas/*": "./src/schemas/*.ts", ... } }
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts            barrel
    │       ├── schemas/{admin,rsvp}.ts
    │       ├── server/
    │       │   ├── context.ts      runWithEnv / getEnv
    │       │   └── lib/{db,schema,fuzzy}.ts
    │       └── components/ui/      {Button,Modal,StatusBadge,...}.tsx|.module.css|statusHelpers.ts
    │
    ├── public/                     @wedding/public — pure source (guest site)
    │   ├── package.json            deps: @wedding/shared, react, react-dom, react-router-dom, zod
    │   ├── tsconfig.json
    │   ├── index.html              shell HTML (entry points to /src/main.tsx)
    │   ├── public/                 static assets (background.jpg, favicon.svg, mountains.png)
    │   └── src/
    │       ├── main.tsx            client entry: setupServerCallback("/@rsc-public/") + router
    │       ├── App.tsx             root page
    │       ├── App.module.css
    │       ├── App.css
    │       ├── typography.module.css
    │       ├── index.css
    │       ├── components/         {AnchorContext,BackgroundLayout,Section}
    │       ├── routes/             {RsvpLookup,RsvpFull,EventCardEditor}
    │       ├── lib/                {rsvpFormState}
    │       ├── rsc-client.ts       scoped to /@rsc-public/
    │       └── server/
    │           ├── rsvp.ts         (from src/server/public/rsvp.ts)
    │           └── rsc-entry.ts    exports default { fetch } — only globs ./server/*.ts
    │
    ├── admin/                      @wedding/admin — pure source (admin SPA)
    │   ├── package.json            deps: @wedding/shared, papaparse, react-hook-form, @hookform/resolvers, @fortawesome/*, jose
    │   ├── tsconfig.json
    │   ├── index.html              admin shell (entry points to /src/main.tsx)
    │   └── src/
    │       ├── main.tsx            client entry: setupServerCallback("/@rsc-admin/") + router with basename=/admin
    │       ├── AdminApp.tsx
    │       ├── AdminApp.module.css
    │       ├── admin.css
    │       ├── api.ts              re-exports server functions from ./server/*
    │       ├── lib/{dateHelpers,rsvpCsv}.ts
    │       ├── routes/             {EditEventForm,EditGroupForm,EventSettings,GroupBlock,GuestDetailModal,GuestList,Import}
    │       ├── rsc-client.ts       scoped to /@rsc-admin/
    │       └── server/
    │           ├── {events,groups,guests,import,responses}.ts
    │           ├── auth.ts         verifyAccessJwt (moved from src/server/auth.ts)
    │           └── rsc-entry.ts    exports default { fetch } — globs ./server/*.ts (not auth.ts), applies verifyAccessJwt with hostname bypass
    │
    └── cloudflare/                 @wedding/cloudflare — host: build orchestration + dispatcher + wrangler
        ├── package.json            deps: @wedding/admin, @wedding/public (workspace:*)
        ├── wrangler.toml           (moved from repo root)
        ├── vite.admin.ts           prod admin build
        ├── vite.public.ts          prod public build
        ├── vite.worker.ts          prod dispatcher build
        ├── vite.dev.ts             dev-only: single Vite serving both apps + union RSC graph
        ├── build.ts                orchestrates: 3 vite builds + asset stitching
        ├── tsconfig.json
        └── src/
            ├── worker.ts           prod dispatcher: path-routes /@rsc-admin/ vs /@rsc-public/
            ├── worker-dev.ts       dev dispatcher: single handler with both URL prefixes
            ├── vite/admin-spa-fallback.ts  (moved)
            └── node-server.ts      (moved — alternate Node deploy; optional)
```

---

## Phase 0 — Pre-flight

### Task 0.1: Ensure clean working tree and tests pass

- [ ] **Step 1: Verify clean working tree**

```bash
git status
```

Expected: no uncommitted changes (or confirm the only diff is the two RSC auth fixes we made earlier in this branch).

- [ ] **Step 2: Run the full test suite as a baseline**

```bash
pnpm db:migrate:local
pnpm test
```

Expected: 78/78 tests pass. If this fails, stop and diagnose before restructuring.

- [ ] **Step 3: Record the baseline dist layout (for comparison after the restructure)**

```bash
pnpm build
ls -la dist/client dist/rsc 2>/dev/null | head -30
```

Note the output. At the end of Phase 6 we'll compare to confirm artifact parity.

- [ ] **Step 4: Commit the plan doc**

```bash
git add docs/plans/2026-04-18-workspace-split.md
git commit -m "Add workspace-split plan"
```

---

## Phase 1 — Scaffold the workspace (no code moves)

### Task 1.1: Create pnpm workspace declaration

**Files:**
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 2: Create empty package directories**

```bash
mkdir -p packages/shared/src packages/public/src packages/admin/src packages/cloudflare/src
```

- [ ] **Step 3: Verify pnpm recognizes the workspace**

```bash
pnpm -r list --depth -1 2>&1 | head
```

Expected: no errors. Package list may be empty (no package.jsons yet).

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml packages/
git commit -m "Declare pnpm workspace with packages/*"
```

Note: the empty src dirs won't be tracked by git until files land in them. That's fine.

---

### Task 1.2: Create skeleton `package.json` for each leaf

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/public/package.json`
- Create: `packages/admin/package.json`
- Create: `packages/cloudflare/package.json`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@wedding/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas/admin": "./src/schemas/admin.ts",
    "./schemas/rsvp": "./src/schemas/rsvp.ts",
    "./server/context": "./src/server/context.ts",
    "./server/lib/db": "./src/server/lib/db.ts",
    "./server/lib/fuzzy": "./src/server/lib/fuzzy.ts",
    "./server/lib/schema": "./src/server/lib/schema.ts",
    "./components/ui/*": "./src/components/ui/*"
  },
  "dependencies": {
    "kysely": "^0.27.5",
    "kysely-d1": "^0.3.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^3.24.2"
  }
}
```

- [ ] **Step 2: `packages/public/package.json`**

```json
{
  "name": "@wedding/public",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./html": "./index.html",
    "./main": "./src/main.tsx",
    "./rsc-entry": "./src/server/rsc-entry.ts"
  },
  "dependencies": {
    "@wedding/shared": "workspace:*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.2.0",
    "zod": "^3.24.2"
  }
}
```

- [ ] **Step 3: `packages/admin/package.json`**

```json
{
  "name": "@wedding/admin",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./html": "./index.html",
    "./main": "./src/main.tsx",
    "./rsc-entry": "./src/server/rsc-entry.ts"
  },
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "^7.1.0",
    "@fortawesome/free-solid-svg-icons": "^7.1.0",
    "@fortawesome/react-fontawesome": "^3.1.1",
    "@hookform/resolvers": "^3.10.0",
    "@wedding/shared": "workspace:*",
    "jose": "^5.10.0",
    "papaparse": "^5.5.2",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.55.0",
    "react-router-dom": "^7.2.0",
    "zod": "^3.24.2"
  }
}
```

- [ ] **Step 4: `packages/cloudflare/package.json`**

```json
{
  "name": "@wedding/cloudflare",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --config vite.dev.ts",
    "build": "tsx build.ts",
    "preview": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "@wedding/admin": "workspace:*",
    "@wedding/public": "workspace:*",
    "@wedding/shared": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.32.3",
    "@cloudflare/workers-types": "^4.20250410.0",
    "@remix-run/node-fetch-server": "^0.13.0",
    "@vitejs/plugin-react": "^5.1.1",
    "@vitejs/plugin-rsc": "~0.5.24",
    "better-sqlite3": "^12.9.0",
    "tsx": "^4.19.2",
    "vite": "^8.0.8",
    "wrangler": "^4.83.0"
  }
}
```

- [ ] **Step 5: Create index barrels so `.` exports don't fail resolution**

```bash
printf "export {}\n" > packages/shared/src/index.ts
printf "export {}\n" > packages/public/src/index.ts
printf "export {}\n" > packages/admin/src/index.ts
```

- [ ] **Step 6: Install and verify workspace resolution**

```bash
pnpm install
```

Expected: pnpm reports `4 packages` discovered (including root). No errors. You'll see `node_modules/@wedding/*` symlinks get created.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml packages/*/package.json packages/*/src/index.ts pnpm-lock.yaml
git commit -m "Scaffold four workspace packages (empty)"
```

---

### Task 1.3: Create skeleton `tsconfig.json` per package

**Files:**
- Create: `packages/shared/tsconfig.json`
- Create: `packages/public/tsconfig.json`
- Create: `packages/admin/tsconfig.json`
- Create: `packages/cloudflare/tsconfig.json`

- [ ] **Step 1: `packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 2: `packages/public/tsconfig.json`**

Identical to `shared` but add `"types": ["vite/client"]` and `"include": ["src"]`.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: `packages/admin/tsconfig.json`**

Identical to public's tsconfig.

- [ ] **Step 4: `packages/cloudflare/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
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
    "noUncheckedSideEffectImports": true,
    "skipLibCheck": true,
    "types": ["node", "@cloudflare/workers-types"]
  },
  "include": ["src", "vite.*.ts", "build.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/*/tsconfig.json
git commit -m "Add tsconfig per workspace package"
```

---

## Phase 2 — Move shared code to `@wedding/shared`

**Goal of this phase:** everything under `src/components/ui/`, `src/server/context.ts`, `src/server/lib/*`, and `shared/schemas/*` moves into `packages/shared/src/`. The rest of the repo (still the old single-app layout) is updated to import from `@wedding/shared` via workspace resolution. Tests pass.

### Task 2.1: Move zod schemas

**Files:**
- Move: `shared/schemas/admin.ts` → `packages/shared/src/schemas/admin.ts`
- Move: `shared/schemas/rsvp.ts` → `packages/shared/src/schemas/rsvp.ts`
- Move: `shared/schemas/admin.test.ts` → `packages/shared/src/schemas/admin.test.ts`
- Move: `shared/schemas/rsvp.test.ts` → `packages/shared/src/schemas/rsvp.test.ts`

- [ ] **Step 1: Move files with `git mv`**

```bash
mkdir -p packages/shared/src/schemas
git mv shared/schemas/admin.ts packages/shared/src/schemas/admin.ts
git mv shared/schemas/rsvp.ts packages/shared/src/schemas/rsvp.ts
git mv shared/schemas/admin.test.ts packages/shared/src/schemas/admin.test.ts
git mv shared/schemas/rsvp.test.ts packages/shared/src/schemas/rsvp.test.ts
rmdir shared/schemas shared 2>/dev/null || true
```

- [ ] **Step 2: Update all `@shared/schemas/*` imports to `@wedding/shared/schemas/*`**

Find every occurrence:

```bash
# Use Grep tool (not raw grep). The patterns to find:
#   from "@shared/schemas/admin"
#   from "@shared/schemas/rsvp"
#   from "@shared/..."
```

Replace pattern across `src/**`, `tests/**`:

```
@shared/schemas/admin  →  @wedding/shared/schemas/admin
@shared/schemas/rsvp   →  @wedding/shared/schemas/rsvp
```

Known files that currently import these:
- `src/server/admin/events.ts`
- `src/server/admin/groups.ts`
- `src/server/admin/guests.ts`
- `src/server/admin/import.ts`
- `src/server/admin/responses.ts`
- `src/server/public/rsvp.ts`
- `src/admin/routes/*.tsx` (many — use Grep to enumerate)
- `src/admin/api.ts`
- `src/admin/lib/rsvpCsv.ts`
- `src/routes/RsvpFull.tsx`
- `src/routes/RsvpLookup.tsx`
- `src/lib/rsvpFormState.ts`

Enumerate with:

```
Grep pattern="@shared/schemas"
```

- [ ] **Step 3: Drop the `@shared/*` alias from `tsconfig.app.json`**

Edit `tsconfig.app.json`: remove the `"paths": { "@shared/*": ["./shared/*"] }` block. `include` should still be `["src", "shared"]` for now — shared gets removed after Phase 7.

Actually remove `"shared"` from `include` too since we've moved everything out.

Result:

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
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Drop the `@shared` alias from `vite.config.ts` / `vite.config.node.ts` / `vitest.config.ts`**

Each of these files has:

```ts
resolve: {
  alias: {
    "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
  },
},
```

Remove that block entirely from all three files. `@wedding/shared` resolves via pnpm workspace symlinks — no alias needed.

- [ ] **Step 5: Run tests to confirm schema imports resolve through workspace**

```bash
pnpm test
```

Expected: 78/78 pass. If a test fails with "Cannot find module `@shared/...`", that's a file that still has the old import — fix it.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas tsconfig.app.json vite.config.ts vite.config.node.ts vitest.config.ts src tests
git rm -r shared 2>/dev/null || true
git commit -m "Move zod schemas to @wedding/shared"
```

---

### Task 2.2: Move server context + lib (db, fuzzy, schema)

**Files:**
- Move: `src/server/context.ts` → `packages/shared/src/server/context.ts`
- Move: `src/server/lib/db.ts` → `packages/shared/src/server/lib/db.ts`
- Move: `src/server/lib/schema.ts` → `packages/shared/src/server/lib/schema.ts`
- Move: `src/server/lib/fuzzy.ts` → `packages/shared/src/server/lib/fuzzy.ts`
- Move: `src/server/lib/db.test.ts` → `packages/shared/src/server/lib/db.test.ts`
- Move: `src/server/lib/fuzzy.test.ts` → `packages/shared/src/server/lib/fuzzy.test.ts`

- [ ] **Step 1: Move files**

```bash
mkdir -p packages/shared/src/server/lib
git mv src/server/context.ts packages/shared/src/server/context.ts
git mv src/server/lib/db.ts packages/shared/src/server/lib/db.ts
git mv src/server/lib/schema.ts packages/shared/src/server/lib/schema.ts
git mv src/server/lib/fuzzy.ts packages/shared/src/server/lib/fuzzy.ts
git mv src/server/lib/db.test.ts packages/shared/src/server/lib/db.test.ts
git mv src/server/lib/fuzzy.test.ts packages/shared/src/server/lib/fuzzy.test.ts
rmdir src/server/lib
```

- [ ] **Step 2: Update imports**

Known callers of `../context`, `../../server/context`, `../lib/db`, `../lib/fuzzy`:

- `src/server/admin/events.ts`
- `src/server/admin/groups.ts`
- `src/server/admin/guests.ts`
- `src/server/admin/import.ts`
- `src/server/admin/responses.ts`
- `src/server/public/rsvp.ts`
- `src/worker.ts` — imports `runWithEnv` from `./server/context`
- `src/node-server.ts` — imports `runWithEnv` from `../dist/rsc/index.js` and `DbSchema` from `./server/lib/schema.ts`
- `tests/e2e/feature-parity.test.ts`
- `tests/e2e/rpc.roundtrip.test.ts`

Replace patterns:
```
from "../context"                       →  from "@wedding/shared/server/context"
from "../lib/db"                        →  from "@wedding/shared/server/lib/db"
from "../lib/fuzzy"                     →  from "@wedding/shared/server/lib/fuzzy"
from "./server/context"                 →  from "@wedding/shared/server/context"
from "./server/lib/schema.ts"           →  from "@wedding/shared/server/lib/schema"
from "../../src/server/lib/schema"      →  from "@wedding/shared/server/lib/schema"
from "../../src/server/context"         →  from "@wedding/shared/server/context"
```

Enumerate with: `Grep pattern="server/(context|lib/)"`

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: 78/78 pass.

Note: `tests/e2e/feature-parity.test.ts` and `tests/e2e/rpc.roundtrip.test.ts` load modules via Vite's RSC environment runner (`loadRscModule("/src/server/public/rsvp.ts")`). Those paths still work because `src/server/public/rsvp.ts` still exists — we haven't moved it yet. They'll get updated in Phase 3.

- [ ] **Step 4: Commit**

```bash
git add packages/shared src tests tsconfig.app.json vite.config.ts vite.config.node.ts vitest.config.ts
git commit -m "Move server context + lib to @wedding/shared"
```

---

### Task 2.3: Move shared UI primitives

**Files:**
- Move: `src/components/ui/*` → `packages/shared/src/components/ui/*`

- [ ] **Step 1: Move the entire ui directory**

```bash
mkdir -p packages/shared/src/components
git mv src/components/ui packages/shared/src/components/ui
```

- [ ] **Step 2: Update imports**

Every file under `src/admin/` that imports `../../components/ui/<Thing>` (or similar relative path) becomes `@wedding/shared/components/ui/<Thing>`.

Enumerate with: `Grep pattern="components/ui"`

Files expected to need updates:
- `src/admin/AdminApp.tsx` (none — check anyway)
- `src/admin/routes/*.tsx` (many)
- `src/admin/api.ts`
- `src/admin/lib/*.ts`
- `src/routes/RsvpFull.tsx`
- `src/routes/RsvpLookup.tsx`
- `src/App.tsx`
- `src/components/Section.tsx` / `src/components/BackgroundLayout.tsx` — check whether they import from ui

Replace pattern (for each `<Thing>` import):
```
from "../../components/ui/<Thing>"    →  from "@wedding/shared/components/ui/<Thing>"
from "../components/ui/<Thing>"       →  from "@wedding/shared/components/ui/<Thing>"
from "./components/ui/<Thing>"        →  from "@wedding/shared/components/ui/<Thing>"
```

CSS module imports use the same convention:
```
from "@wedding/shared/components/ui/<Thing>.module.css"
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Note: tests don't exercise UI components directly (all vitest tests are schema, db, fuzzy, rsc roundtrip, feature-parity — none render React). This step mostly confirms the module resolver can find `@wedding/shared/components/ui/*`.

- [ ] **Step 4: Sanity check the dev server**

```bash
pnpm dev
```

In another terminal:
```bash
curl -s http://localhost:5173/ | head -5
curl -s http://localhost:5173/admin/ | head -5
```

Both should return HTML (not errors). Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add packages/shared src
git commit -m "Move shared UI primitives to @wedding/shared"
```

---

### Task 2.4: Create the `@wedding/shared` barrel

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the barrel**

Replace the placeholder `export {}` with re-exports that make the most common imports reachable via the bare `@wedding/shared` specifier:

```ts
export * from "./schemas/admin";
export * from "./schemas/rsvp";
export { runWithEnv, getEnv } from "./server/context";
export type { ServerEnv } from "./server/context";
export { getDb, newId, newInviteCode, nowIso } from "./server/lib/db";
export type { Db } from "./server/lib/db";
export type {
  Database,
  GuestTable,
  // add other tables as found in schema.ts
} from "./server/lib/schema";
```

Confirm exact exports by reading `packages/shared/src/server/lib/schema.ts` and re-exporting every named table/interface it defines.

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "Add @wedding/shared barrel export"
```

---

### Phase 2 checkpoint

```bash
pnpm test
```

Expected: 78/78 pass. The old layout (src/routes, src/admin, src/server/admin, src/server/public, src/components, src/App.tsx, etc.) is still in place, but every shared thing now flows through `@wedding/shared` via workspace resolution.

---

## Phase 3 — Move public site to `@wedding/public`

### Task 3.1: Move public source files

**Files to move (as-is, no content changes):**
- `index.html` → `packages/public/index.html`
- `public/background.jpg` → `packages/public/public/background.jpg`
- `public/favicon.svg` → `packages/public/public/favicon.svg`
- `public/mountains.png` → `packages/public/public/mountains.png`
- `src/main.tsx` → `packages/public/src/main.tsx`
- `src/App.tsx` → `packages/public/src/App.tsx`
- `src/App.css` → `packages/public/src/App.css`
- `src/App.module.css` → `packages/public/src/App.module.css`
- `src/index.css` → `packages/public/src/index.css`
- `src/typography.module.css` → `packages/public/src/typography.module.css`
- `src/components/AnchorContext.tsx` → `packages/public/src/components/AnchorContext.tsx`
- `src/components/BackgroundLayout.tsx` → `packages/public/src/components/BackgroundLayout.tsx`
- `src/components/BackgroundLayout.module.css` → `packages/public/src/components/BackgroundLayout.module.css`
- `src/components/Section.tsx` → `packages/public/src/components/Section.tsx`
- `src/components/Section.module.css` → `packages/public/src/components/Section.module.css`
- `src/routes/RsvpLookup.tsx` → `packages/public/src/routes/RsvpLookup.tsx`
- `src/routes/RsvpLookup.module.css` → `packages/public/src/routes/RsvpLookup.module.css`
- `src/routes/RsvpFull.tsx` → `packages/public/src/routes/RsvpFull.tsx`
- `src/routes/RsvpFull.module.css` → `packages/public/src/routes/RsvpFull.module.css`
- `src/routes/EventCardEditor.tsx` → `packages/public/src/routes/EventCardEditor.tsx`
- `src/lib/rsvpFormState.ts` → `packages/public/src/lib/rsvpFormState.ts`
- `src/server/public/rsvp.ts` → `packages/public/src/server/rsvp.ts`

- [ ] **Step 1: Move with `git mv`**

```bash
mkdir -p packages/public/public packages/public/src/{components,routes,lib,server}

git mv index.html packages/public/index.html
git mv public/background.jpg packages/public/public/background.jpg
git mv public/favicon.svg packages/public/public/favicon.svg
git mv public/mountains.png packages/public/public/mountains.png
rmdir public

git mv src/main.tsx packages/public/src/main.tsx
git mv src/App.tsx packages/public/src/App.tsx
git mv src/App.css packages/public/src/App.css
git mv src/App.module.css packages/public/src/App.module.css
git mv src/index.css packages/public/src/index.css
git mv src/typography.module.css packages/public/src/typography.module.css

git mv src/components/AnchorContext.tsx packages/public/src/components/AnchorContext.tsx
git mv src/components/BackgroundLayout.tsx packages/public/src/components/BackgroundLayout.tsx
git mv src/components/BackgroundLayout.module.css packages/public/src/components/BackgroundLayout.module.css
git mv src/components/Section.tsx packages/public/src/components/Section.tsx
git mv src/components/Section.module.css packages/public/src/components/Section.module.css
rmdir src/components

git mv src/routes/RsvpLookup.tsx packages/public/src/routes/RsvpLookup.tsx
git mv src/routes/RsvpLookup.module.css packages/public/src/routes/RsvpLookup.module.css
git mv src/routes/RsvpFull.tsx packages/public/src/routes/RsvpFull.tsx
git mv src/routes/RsvpFull.module.css packages/public/src/routes/RsvpFull.module.css
git mv src/routes/EventCardEditor.tsx packages/public/src/routes/EventCardEditor.tsx
rmdir src/routes

git mv src/lib/rsvpFormState.ts packages/public/src/lib/rsvpFormState.ts
rmdir src/lib

git mv src/server/public/rsvp.ts packages/public/src/server/rsvp.ts
rmdir src/server/public
```

- [ ] **Step 2: Update the script tag in `packages/public/index.html`**

Open `packages/public/index.html`. Change:
```html
<script type="module" src="/src/main.tsx"></script>
```
Keep it as-is. In a standalone package Vite treats `/src/main.tsx` as relative to the package root (where `index.html` lives), which is now `packages/public/`. Same resolution.

- [ ] **Step 3: Update the `'../index.css'` import in `src/admin/main.tsx`**

`src/admin/main.tsx` has `import '../index.css'` (reaching into the public package's `index.css`). This is wrong cross-package coupling — admin should not reach into public. Two options:

- Option A (recommended): remove that import. The admin shell has its own `admin.css` and uses shared UI primitives; it doesn't need the public site's base stylesheet.
- Option B: duplicate the small base styles into `packages/admin/src/index.css`.

Go with A. Open `src/admin/main.tsx` and delete the `import '../index.css'` line.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: the two e2e tests that load public rsvp through the RSC runner (`tests/e2e/feature-parity.test.ts` uses `loadRscModule("/src/server/public/rsvp.ts")`, `tests/e2e/rpc.roundtrip.test.ts` uses `"/src/server/public/rsvp.ts"`) will now fail because that file no longer exists at that path. This is expected — fix in Step 5.

- [ ] **Step 5: Update e2e test module paths for public**

In `tests/e2e/feature-parity.test.ts`:
```
"/src/server/public/rsvp.ts"   →  "/packages/public/src/server/rsvp.ts"
```
Adjust the type-level import at the top too:
```
"../../src/server/public/rsvp"  →  "../../packages/public/src/server/rsvp"
```

Same edit in `tests/e2e/rpc.roundtrip.test.ts`.

NOTE: the Vite dev server (`createServer({ configFile: "./vite.config.node.ts" })`) resolves these paths relative to the workspace root, so the new path `packages/public/src/server/rsvp.ts` is correct. The RSC env runner will pick up the `"use server"` directive from the new location.

- [ ] **Step 6: Run tests again**

```bash
pnpm test
```

Expected: 78/78 pass.

- [ ] **Step 7: Commit**

```bash
git add packages/public src tests
git commit -m "Move public site source to @wedding/public"
```

---

### Task 3.2: Create the public-side RSC entry + client prefix

The public rsc-client currently lives at `src/rsc-client.ts` and is shared between admin and public with a hardcoded `/@rsc/` URL. We need to split this into per-package clients with distinct prefixes, and add a per-package RSC server entry that only globs its own server actions.

**Files:**
- Create: `packages/public/src/rsc-client.ts`
- Create: `packages/public/src/server/rsc-entry.ts`
- Modify: `packages/public/src/main.tsx`

- [ ] **Step 1: Write `packages/public/src/rsc-client.ts`**

```ts
import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";

const RSC_PREFIX = "/@rsc-public/";

export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args);
    const response = fetch(`${RSC_PREFIX}${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "rsc-action-id": id },
      body,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Server action ${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`,
        );
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/x-component")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Server action ${id} returned unexpected content-type "${ct || "<missing>"}": ${text.slice(0, 200)}`,
        );
      }
      return res;
    });
    return createFromFetch(response);
  });
}
```

- [ ] **Step 2: Update `packages/public/src/main.tsx` to import from the local rsc-client**

Change:
```ts
import { setupServerCallback } from './rsc-client'
```
The import path is already `./rsc-client` (it was relative to `src/`); no change needed because we moved rsc-client alongside main.tsx. Verify the file is at `packages/public/src/rsc-client.ts` — confirm the relative path resolves.

- [ ] **Step 3: Write `packages/public/src/server/rsc-entry.ts`**

This replaces the shared `src/entry.rsc.ts` for the public side. It has NO authorize callback (public actions are open), and it globs ONLY this package's server actions.

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";

// Auto-discover server-action modules in this package only. The glob result's
// exports become server references at module-load time (plugin-rsc attaches
// $$id to each "use server" export during graph walk).
const publicModules = import.meta.glob<Record<string, unknown>>(
  "./*.ts",
  { eager: true }
);

function collectActionIds(modules: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key];
      if (typeof value !== "function") continue;
      const $$id = (value as { $$id?: unknown }).$$id;
      if (typeof $$id === "string") ids.add($$id);
    }
  }
  return ids;
}

const actionIds = collectActionIds(Object.values(publicModules));
const RSC_PREFIX = "/@rsc-public/";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(RSC_PREFIX)) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const actionId = decodeURIComponent(url.pathname.slice(RSC_PREFIX.length));
    if (!actionIds.has(actionId)) {
      return new Response("Forbidden", { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("multipart/form-data")
      ? await request.formData()
      : await request.text();

    const args = await decodeReply(body);
    const fn = await loadServerAction(actionId);
    const result = await fn(...args);

    const stream = renderToReadableStream(result);
    return new Response(stream, {
      headers: { "content-type": "text/x-component" },
    });
  },
} satisfies { fetch: (request: Request) => Promise<Response> };
```

The glob `"./*.ts"` picks up `rsvp.ts` (the only public server module). Exclude `rsc-entry.ts` itself — `import.meta.glob` with a literal pattern won't import the file doing the globbing, but verify by listing the glob result in dev.

Actually wait: `"./*.ts"` WILL include `rsc-entry.ts`. Exclude it via a negative pattern or rename the server dir. Change the glob to be explicit:

```ts
const publicModules = import.meta.glob<Record<string, unknown>>(
  "./*.ts",
  { eager: true, import: undefined }
);
// Filter out self-reference — the glob includes this file too.
delete (publicModules as Record<string, unknown>)["./rsc-entry.ts"];
```

Actually cleaner: make a subdirectory `./actions/` for server actions and glob that. Skip this reorg for MVP — just do the `delete` above.

- [ ] **Step 4: Commit**

```bash
git add packages/public/src/rsc-client.ts packages/public/src/server/rsc-entry.ts packages/public/src/main.tsx
git commit -m "Add per-package RSC client + entry for public"
```

---

## Phase 4 — Move admin app to `@wedding/admin`

### Task 4.1: Move admin source files

**Files to move:**
- `admin/index.html` → `packages/admin/index.html`
- `src/admin/main.tsx` → `packages/admin/src/main.tsx`
- `src/admin/AdminApp.tsx` → `packages/admin/src/AdminApp.tsx`
- `src/admin/AdminApp.module.css` → `packages/admin/src/AdminApp.module.css`
- `src/admin/admin.css` → `packages/admin/src/admin.css`
- `src/admin/api.ts` → `packages/admin/src/api.ts`
- `src/admin/lib/dateHelpers.ts` → `packages/admin/src/lib/dateHelpers.ts`
- `src/admin/lib/rsvpCsv.ts` → `packages/admin/src/lib/rsvpCsv.ts`
- `src/admin/routes/*` → `packages/admin/src/routes/*` (all 9 files)
- `src/server/admin/events.ts` → `packages/admin/src/server/events.ts`
- `src/server/admin/groups.ts` → `packages/admin/src/server/groups.ts`
- `src/server/admin/guests.ts` → `packages/admin/src/server/guests.ts`
- `src/server/admin/import.ts` → `packages/admin/src/server/import.ts`
- `src/server/admin/responses.ts` → `packages/admin/src/server/responses.ts`
- `src/server/auth.ts` → `packages/admin/src/server/auth.ts`

- [ ] **Step 1: Move everything**

```bash
mkdir -p packages/admin/src/{lib,routes,server}

git mv admin/index.html packages/admin/index.html
rmdir admin

git mv src/admin/main.tsx packages/admin/src/main.tsx
git mv src/admin/AdminApp.tsx packages/admin/src/AdminApp.tsx
git mv src/admin/AdminApp.module.css packages/admin/src/AdminApp.module.css
git mv src/admin/admin.css packages/admin/src/admin.css
git mv src/admin/api.ts packages/admin/src/api.ts
git mv src/admin/lib/dateHelpers.ts packages/admin/src/lib/dateHelpers.ts
git mv src/admin/lib/rsvpCsv.ts packages/admin/src/lib/rsvpCsv.ts
rmdir src/admin/lib

git mv src/admin/routes/EditEventForm.tsx packages/admin/src/routes/EditEventForm.tsx
git mv src/admin/routes/EditEventForm.module.css packages/admin/src/routes/EditEventForm.module.css
git mv src/admin/routes/EditGroupForm.tsx packages/admin/src/routes/EditGroupForm.tsx
git mv src/admin/routes/EditGroupForm.module.css packages/admin/src/routes/EditGroupForm.module.css
git mv src/admin/routes/EventSettings.tsx packages/admin/src/routes/EventSettings.tsx
git mv src/admin/routes/GroupBlock.tsx packages/admin/src/routes/GroupBlock.tsx
git mv src/admin/routes/GuestDetailModal.tsx packages/admin/src/routes/GuestDetailModal.tsx
git mv src/admin/routes/GuestList.tsx packages/admin/src/routes/GuestList.tsx
git mv src/admin/routes/GuestList.module.css packages/admin/src/routes/GuestList.module.css
git mv src/admin/routes/Import.tsx packages/admin/src/routes/Import.tsx
git mv src/admin/routes/Import.module.css packages/admin/src/routes/Import.module.css
rmdir src/admin/routes src/admin

git mv src/server/admin/events.ts packages/admin/src/server/events.ts
git mv src/server/admin/groups.ts packages/admin/src/server/groups.ts
git mv src/server/admin/guests.ts packages/admin/src/server/guests.ts
git mv src/server/admin/import.ts packages/admin/src/server/import.ts
git mv src/server/admin/responses.ts packages/admin/src/server/responses.ts
rmdir src/server/admin

git mv src/server/auth.ts packages/admin/src/server/auth.ts
rmdir src/server 2>/dev/null || true
```

- [ ] **Step 2: Update the admin script tag in `packages/admin/index.html`**

Currently:
```html
<script type="module" src="/src/admin/main.tsx"></script>
```

Change to:
```html
<script type="module" src="/src/main.tsx"></script>
```

Because `index.html` is now at `packages/admin/index.html` and `main.tsx` is at `packages/admin/src/main.tsx`.

- [ ] **Step 3: Update the shared `src/rsc-client.ts` import in `packages/admin/src/main.tsx`**

`packages/admin/src/main.tsx` currently imports `from '../rsc-client'`. We'll create a per-package rsc-client in Task 4.2. For now, change to:

```ts
import { setupServerCallback } from './rsc-client'
```

(forward reference to a file we'll create in Task 4.2).

- [ ] **Step 4: Update e2e test paths**

`tests/e2e/feature-parity.test.ts` loads modules like:
```
"/src/server/admin/events.ts"  →  "/packages/admin/src/server/events.ts"
"/src/server/admin/groups.ts"  →  "/packages/admin/src/server/groups.ts"
"/src/server/admin/guests.ts"  →  "/packages/admin/src/server/guests.ts"
"/src/server/admin/import.ts"  →  "/packages/admin/src/server/import.ts"
"/src/server/admin/responses.ts" → "/packages/admin/src/server/responses.ts"
```

Also update the type-only `import("../../src/server/admin/...")` specifiers to `import("../../packages/admin/src/server/...")`.

Same edits in `tests/e2e/rpc.roundtrip.test.ts`.

Also in `tests/e2e/admin-auth.test.ts`: `loadRscModule("/src/server/admin/events.ts")` → `loadRscModule("/packages/admin/src/server/events.ts")`, and the type specifiers.

- [ ] **Step 5: Update imports INSIDE the moved admin files**

Many admin route files had imports like `../../components/ui/Button` (pre-Phase 2 they resolved). After Phase 2 they should all be `@wedding/shared/components/ui/Button`. Confirm with:

```
Grep pattern="components/ui" path="packages/admin"
```

Fix any stragglers. Same for `../lib/dateHelpers` etc. — these are intra-package and should continue to work as relative paths.

Check `packages/admin/src/api.ts` — it re-exports from `../server/admin/*`. After the move it should re-export from `./server/*`. Update:

```ts
// Before:
import { listEvents, saveEvent, type AdminEventRecord } from "../server/admin/events";
import { listGroups, saveGroup, deleteGroup, getGroup } from "../server/admin/groups";
import { getGuest } from "../server/admin/guests";
import { listResponses } from "../server/admin/responses";
import { importRows, type ImportResult } from "../server/admin/import";

// After:
import { listEvents, saveEvent, type AdminEventRecord } from "./server/events";
import { listGroups, saveGroup, deleteGroup, getGroup } from "./server/groups";
import { getGuest } from "./server/guests";
import { listResponses } from "./server/responses";
import { importRows, type ImportResult } from "./server/import";
```

- [ ] **Step 6: Run tests**

```bash
pnpm test
```

Expected: `admin-auth.test.ts` still passes (uses `createRscHandler` from `src/entry.rsc.ts` which still exists at root — we haven't moved that yet). The other two pass because their module paths are updated.

78/78.

- [ ] **Step 7: Commit**

```bash
git add packages/admin src tests
git commit -m "Move admin app source to @wedding/admin"
```

---

### Task 4.2: Create the admin-side RSC entry + client prefix

**Files:**
- Create: `packages/admin/src/rsc-client.ts`
- Create: `packages/admin/src/server/rsc-entry.ts`

- [ ] **Step 1: Write `packages/admin/src/rsc-client.ts`**

Identical to the public one but with `/@rsc-admin/` prefix:

```ts
import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from "@vitejs/plugin-rsc/browser";

const RSC_PREFIX = "/@rsc-admin/";

export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args);
    const response = fetch(`${RSC_PREFIX}${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "rsc-action-id": id },
      body,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Server action ${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`,
        );
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/x-component")) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Server action ${id} returned unexpected content-type "${ct || "<missing>"}": ${text.slice(0, 200)}`,
        );
      }
      return res;
    });
    return createFromFetch(response);
  });
}
```

- [ ] **Step 2: Write `packages/admin/src/server/rsc-entry.ts`**

Includes the hostname-bypass pattern from Fix A, plus the `verifyAccessJwt` defense-in-depth, but the auth check is now INSIDE the entry — no separate wrapper handler needed. And no allowlist — this entry only knows admin actions because it globs only admin source files.

```ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";
import { verifyAccessJwt } from "./auth";

const adminModules = import.meta.glob<Record<string, unknown>>(
  "./*.ts",
  { eager: true }
);
// The glob includes rsc-entry.ts and auth.ts; filter them out so we don't
// register stray exports as action IDs.
delete (adminModules as Record<string, unknown>)["./rsc-entry.ts"];
delete (adminModules as Record<string, unknown>)["./auth.ts"];

function collectActionIds(modules: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key];
      if (typeof value !== "function") continue;
      const $$id = (value as { $$id?: unknown }).$$id;
      if (typeof $$id === "string") ids.add($$id);
    }
  }
  return ids;
}

const actionIds = collectActionIds(Object.values(adminModules));
const RSC_PREFIX = "/@rsc-admin/";

// Loopback hostnames can't be reached on a deployed Cloudflare Worker, so
// this is a safe trusted-dev signal without new env vars.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

interface AdminEnv {
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
}

export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(RSC_PREFIX)) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Defense-in-depth: Cloudflare Access should gate /@rsc-admin/* at the
    // edge (one dashboard rule), but verify the JWT here too so a direct hit
    // to the Worker's *.workers.dev URL (if ever enabled) can't bypass.
    if (!LOCAL_HOSTNAMES.has(url.hostname)) {
      const ok =
        env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN
          ? await verifyAccessJwt(request, {
              aud: env.ACCESS_AUD,
              teamDomain: env.ACCESS_TEAM_DOMAIN,
            })
          : false;
      if (!ok) return new Response("Unauthorized", { status: 401 });
    }

    const actionId = decodeURIComponent(url.pathname.slice(RSC_PREFIX.length));
    if (!actionIds.has(actionId)) {
      return new Response("Forbidden", { status: 403 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const body = contentType.includes("multipart/form-data")
      ? await request.formData()
      : await request.text();

    const args = await decodeReply(body);
    const fn = await loadServerAction(actionId);
    const result = await fn(...args);

    const stream = renderToReadableStream(result);
    return new Response(stream, {
      headers: { "content-type": "text/x-component" },
    });
  },
} satisfies { fetch: (request: Request, env: AdminEnv) => Promise<Response> };
```

Note the env change: `verifyAccessJwt` now reads config from `env.ACCESS_AUD` / `env.ACCESS_TEAM_DOMAIN`, not globals. This removes the `globalThis` shim the old code used (and the TODO comment noting it was tech debt). The env is threaded from the dispatcher Worker.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/rsc-client.ts packages/admin/src/server/rsc-entry.ts
git commit -m "Add per-package RSC client + entry for admin"
```

---

## Phase 5 — `@wedding/cloudflare` host package

### Task 5.1: Move Wrangler config + Node server + SPA fallback

**Files:**
- Move: `wrangler.toml` → `packages/cloudflare/wrangler.toml`
- Move: `src/node-server.ts` → `packages/cloudflare/src/node-server.ts`
- Move: `src/vite/admin-spa-fallback.ts` → `packages/cloudflare/src/vite/admin-spa-fallback.ts`

- [ ] **Step 1: Move files**

```bash
mkdir -p packages/cloudflare/src/vite

git mv wrangler.toml packages/cloudflare/wrangler.toml
git mv src/node-server.ts packages/cloudflare/src/node-server.ts
git mv src/vite/admin-spa-fallback.ts packages/cloudflare/src/vite/admin-spa-fallback.ts
rmdir src/vite
```

- [ ] **Step 2: Update `packages/cloudflare/wrangler.toml` paths**

Original had:
```toml
main = "./src/worker.ts"

[assets]
directory = "./dist/client"
```

Since wrangler.toml is now inside `packages/cloudflare/`, paths are relative to that dir. The dispatcher Worker we create in Task 5.3 will be at `./src/worker.ts` (relative to the package). Assets will be stitched to `./dist/client` by `build.ts`. So the values stay the same:

```toml
name = "wedding-kavari-searls-net"
main = "./src/worker.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "wedding"
database_id = "REPLACE_ME_WITH_REAL_ID"

[assets]
directory = "./dist/client"
binding = "ASSETS"
not_found_handling = "none"
```

Keep the comment block about the placeholder ID intact.

- [ ] **Step 3: Update `packages/cloudflare/src/node-server.ts` imports**

Current imports:
```ts
import { createRscHandler, runWithEnv } from "../dist/rsc/index.js";
import type { Database as DbSchema } from "./server/lib/schema.ts";
```

Update to point at the new locations (the Node server will be rewritten in Task 5.5 to dispatch between admin and public handlers — for now just fix the imports so it still compiles):

```ts
import { runWithEnv } from "@wedding/shared/server/context";
import type { Database as DbSchema } from "@wedding/shared/server/lib/schema";
// dispatcher handler comes from the built output at "../dist/worker.js"
// @ts-expect-error built artifact, no types
import dispatcher from "../dist/worker.js";
```

We'll rewrite the handler body in Task 5.5 to use the dispatcher. Skip running node-server.ts right now — it requires a built dist that doesn't exist yet.

- [ ] **Step 4: Commit**

```bash
git add packages/cloudflare src
git commit -m "Move wrangler config, node-server, and spa-fallback to @wedding/cloudflare"
```

---

### Task 5.2: Remove the root-level Vite configs and entry.rsc.ts

At this point, `vite.config.ts` and `vite.config.node.ts` at the root refer to moved files. They'll be replaced by per-purpose configs inside the cloudflare package. `src/entry.rsc.ts`, `src/worker.ts`, `src/rsc-client.ts` are also obsolete — each package has its own.

- [ ] **Step 1: Delete root-level artifacts**

```bash
git rm vite.config.ts vite.config.node.ts
git rm src/entry.rsc.ts src/worker.ts src/rsc-client.ts
rmdir src 2>/dev/null || true
```

- [ ] **Step 2: Confirm `src/` is now empty / gone**

```bash
ls src 2>/dev/null
```

Expected: "No such file or directory".

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "Remove root-level Vite configs and entry.rsc (superseded by per-package)"
```

Note: tests will fail after this commit because `tests/e2e/rpc.roundtrip.test.ts` and `admin-auth.test.ts` both load `"../../src/entry.rsc.ts"`. That gets fixed in Task 5.4.

---

### Task 5.3: Write the dispatcher Worker

**Files:**
- Create: `packages/cloudflare/src/worker.ts`

- [ ] **Step 1: Write it**

```ts
import adminHandler from "@wedding/admin/rsc-entry";
import publicHandler from "@wedding/public/rsc-entry";
import { runWithEnv } from "@wedding/shared/server/context";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/@rsc-admin/")) {
        return adminHandler.fetch(request, env);
      }
      if (url.pathname.startsWith("/@rsc-public/")) {
        return publicHandler.fetch(request);
      }

      // Static assets with SPA fallback between the two shells.
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;

      const shellPath = url.pathname.startsWith("/admin/") ? "/admin/" : "/";
      const shellUrl = new URL(shellPath, url);
      return env.ASSETS.fetch(new Request(shellUrl, request));
    });
  },
} satisfies ExportedHandler<Env>;
```

Notes:
- No action allowlist — each sub-handler enforces its own.
- No auth wrapper — the admin sub-handler does its own Access-JWT verification (with hostname bypass).
- `runWithEnv` wraps both so `getEnv()` works inside server actions regardless of which handler answers.
- `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` are passed to the admin handler via `env` — removes the old `globalThis` shim.

- [ ] **Step 2: Commit**

```bash
git add packages/cloudflare/src/worker.ts
git commit -m "Add dispatcher Worker for @wedding/cloudflare"
```

---

### Task 5.4: Write the dev Vite config + dev Worker

Dev mode serves both apps on one port with a union RSC graph (auth bypassed via hostname). This is what `pnpm dev` at the root will run.

**Files:**
- Create: `packages/cloudflare/vite.dev.ts`
- Create: `packages/cloudflare/src/worker-dev.ts`

- [ ] **Step 1: Write `packages/cloudflare/src/worker-dev.ts`**

Dev dispatcher — uses the two package-level RSC entries but globs BOTH leaves' server actions into each handler's namespace isn't possible without a shared RSC graph. The simpler approach: in dev, treat both RSC entries identically (both act against the union RSC graph that plugin-rsc builds from the single dev server). The per-package auth is still enforced because each entry globs its own source.

Wait — this contradicts "union RSC graph". Let me clarify:

In dev, plugin-rsc walks from ONE rsc entry. So either we pick one entry (then only one side's actions are discoverable) OR we make the dev rsc entry glob both sides.

Approach chosen: the **dev** rsc entry is a dedicated file that globs BOTH admin and public actions and enforces URL-prefix routing itself:

```ts
// packages/cloudflare/src/worker-dev.ts
import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from "@vitejs/plugin-rsc/rsc";
import { runWithEnv } from "@wedding/shared/server/context";

// Glob BOTH leaves' server actions into one RSC graph for dev convenience.
// Auth concerns are handled below via hostname bypass.
const adminModules = import.meta.glob<Record<string, unknown>>(
  "/packages/admin/src/server/*.ts",
  { eager: true }
);
delete (adminModules as Record<string, unknown>)["/packages/admin/src/server/rsc-entry.ts"];
delete (adminModules as Record<string, unknown>)["/packages/admin/src/server/auth.ts"];

const publicModules = import.meta.glob<Record<string, unknown>>(
  "/packages/public/src/server/*.ts",
  { eager: true }
);
delete (publicModules as Record<string, unknown>)["/packages/public/src/server/rsc-entry.ts"];

function collectActionIds(modules: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const mod of modules) {
    for (const key of Object.keys(mod)) {
      const value = (mod as Record<string, unknown>)[key];
      if (typeof value !== "function") continue;
      const $$id = (value as { $$id?: unknown }).$$id;
      if (typeof $$id === "string") ids.add($$id);
    }
  }
  return ids;
}

const adminIds = collectActionIds(Object.values(adminModules));
const publicIds = collectActionIds(Object.values(publicModules));

export interface DevEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
}

async function runAction(actionId: string, request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("multipart/form-data")
    ? await request.formData()
    : await request.text();
  const args = await decodeReply(body);
  const fn = await loadServerAction(actionId);
  const result = await fn(...args);
  const stream = renderToReadableStream(result);
  return new Response(stream, { headers: { "content-type": "text/x-component" } });
}

export default {
  async fetch(request: Request, env: DevEnv): Promise<Response> {
    return runWithEnv(env, async () => {
      const url = new URL(request.url);

      if (url.pathname.startsWith("/@rsc-admin/")) {
        const actionId = decodeURIComponent(url.pathname.slice("/@rsc-admin/".length));
        if (!adminIds.has(actionId)) return new Response("Forbidden", { status: 403 });
        return runAction(actionId, request);
      }

      if (url.pathname.startsWith("/@rsc-public/")) {
        const actionId = decodeURIComponent(url.pathname.slice("/@rsc-public/".length));
        if (!publicIds.has(actionId)) return new Response("Forbidden", { status: 403 });
        return runAction(actionId, request);
      }

      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) return assetResponse;
      const shellPath = url.pathname.startsWith("/admin/") ? "/admin/" : "/";
      const shellUrl = new URL(shellPath, url);
      return env.ASSETS.fetch(new Request(shellUrl, request));
    });
  },
} satisfies ExportedHandler<DevEnv>;
```

No auth check — dev only runs on localhost (cloudflare plugin binds to loopback). In prod, the real dispatcher (`worker.ts`) is used and the admin sub-handler enforces Access-JWT verification.

- [ ] **Step 2: Write `packages/cloudflare/vite.dev.ts`**

This drives `pnpm dev`. Two HTML entries, one cloudflare worker (the dev dispatcher), admin SPA fallback plugin, React plugin, plugin-rsc.

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { adminSpaFallback } from "./src/vite/admin-spa-fallback";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: repoRoot,
  plugins: [
    cloudflare({
      viteEnvironment: { name: "rsc" },
      configPath: "./packages/cloudflare/wrangler.toml",
    }),
    rsc({
      entries: { rsc: "./packages/cloudflare/src/worker-dev.ts" },
      serverHandler: false,
    }),
    adminSpaFallback(),
    react(),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(repoRoot, "packages/public/index.html"),
            admin: resolve(repoRoot, "packages/admin/index.html"),
          },
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

Notes:
- `root: repoRoot` so the dev server serves both package HTML shells. Vite's default is to derive root from the config file location, which would lock us into `packages/cloudflare/`.
- `adminSpaFallback` still works — it rewrites `/admin/<anything>` to `/admin/` before Vite resolves the HTML.

- [ ] **Step 3: Run the dev server**

```bash
pnpm --filter @wedding/cloudflare dev
```

Open `http://localhost:5173/` (public) and `http://localhost:5173/admin/groups` (admin) in a browser. Both should load. Use the Playwright probe from earlier to confirm no errors:

```bash
cd /tmp/pw-debug && node probe.mjs
```

Expected: body text includes "Wedding Admin" and a guest row; no 401s, no "Connection closed."

- [ ] **Step 4: Commit**

```bash
git add packages/cloudflare/vite.dev.ts packages/cloudflare/src/worker-dev.ts
git commit -m "Add dev Vite config + dev dispatcher for @wedding/cloudflare"
```

---

### Task 5.5: Write the two prod Vite configs

**Files:**
- Create: `packages/cloudflare/vite.admin.ts`
- Create: `packages/cloudflare/vite.public.ts`

Each builds ONE leaf's RSC bundle + its client bundle into a subdirectory of `packages/cloudflare/dist/`.

- [ ] **Step 1: Write `packages/cloudflare/vite.admin.ts`**

```ts
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const pkgAdmin = fileURLToPath(new URL("../admin/", import.meta.url));

export default defineConfig({
  root: pkgAdmin,
  plugins: [
    rsc({
      entries: { rsc: resolve(pkgAdmin, "src/server/rsc-entry.ts") },
      serverHandler: false,
    }),
    react(),
  ],
  build: {
    outDir: fileURLToPath(new URL("./dist/admin", import.meta.url)),
    emptyOutDir: true,
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            admin: resolve(pkgAdmin, "index.html"),
          },
        },
      },
    },
  },
});
```

- [ ] **Step 2: Write `packages/cloudflare/vite.public.ts`**

```ts
import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const pkgPublic = fileURLToPath(new URL("../public/", import.meta.url));

export default defineConfig({
  root: pkgPublic,
  plugins: [
    rsc({
      entries: { rsc: resolve(pkgPublic, "src/server/rsc-entry.ts") },
      serverHandler: false,
    }),
    react(),
  ],
  build: {
    outDir: fileURLToPath(new URL("./dist/public", import.meta.url)),
    emptyOutDir: true,
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(pkgPublic, "index.html"),
          },
        },
      },
    },
  },
});
```

- [ ] **Step 3: Run each build once to shake out path issues**

```bash
cd packages/cloudflare
pnpm exec vite build --config vite.admin.ts
pnpm exec vite build --config vite.public.ts
ls -la dist/admin dist/public
```

Expected: each dist has a `client/` and `rsc/` subdirectory. If either build errors on a missing module, fix the path.

- [ ] **Step 4: Commit**

```bash
git add packages/cloudflare/vite.admin.ts packages/cloudflare/vite.public.ts
git commit -m "Add prod Vite configs for admin and public builds"
```

---

### Task 5.6: Write `build.ts` orchestrator

**Files:**
- Create: `packages/cloudflare/build.ts`

- [ ] **Step 1: Write the orchestrator**

```ts
import { cp, mkdir, rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "node:path";

const pkgDir = fileURLToPath(new URL("./", import.meta.url));
const distDir = resolve(pkgDir, "dist");
const distAdmin = resolve(distDir, "admin");
const distPublic = resolve(distDir, "public");
const distClient = resolve(distDir, "client");

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit", cwd: pkgDir });
}

async function main() {
  console.log("[build] cleaning dist/");
  await rm(distDir, { recursive: true, force: true });

  console.log("[build] building public (vite.public.ts)");
  run("pnpm exec vite build --config vite.public.ts");

  console.log("[build] building admin (vite.admin.ts)");
  run("pnpm exec vite build --config vite.admin.ts");

  console.log("[build] stitching client assets into dist/client/");
  await mkdir(distClient, { recursive: true });
  // Public client → dist/client/ (root)
  await cp(resolve(distPublic, "client"), distClient, { recursive: true });
  // Admin client → dist/client/admin/
  await cp(resolve(distAdmin, "client"), resolve(distClient, "admin"), {
    recursive: true,
  });

  console.log("[build] building dispatcher Worker (wrangler will pick up src/worker.ts)");
  // The dispatcher Worker imports pre-built RSC bundles via workspace imports
  // (@wedding/admin/rsc-entry, @wedding/public/rsc-entry). Wrangler bundles
  // the Worker itself during `wrangler deploy`. No extra build step needed.

  console.log("[build] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Wait — there's a problem. The dispatcher imports `@wedding/admin/rsc-entry` and `@wedding/public/rsc-entry`, which resolve to each leaf's `src/server/rsc-entry.ts`. When wrangler bundles the dispatcher, it'll pull those in and plugin-rsc needs to have run on them to attach `$$id`. Wrangler doesn't run Vite plugins.

So the dispatcher needs to import the pre-BUILT RSC bundles, not the source. Adjust:

- The two Vite builds output `dist/<leaf>/rsc/index.js` (the built RSC bundle).
- The dispatcher worker should import from `./admin/rsc/index.js` and `./public/rsc/index.js` (relative paths within dist).
- Wrangler bundles `src/worker.ts` — we need to either (a) have the worker source reference the dist paths and wrangler will resolve them because wrangler is run with cwd=packages/cloudflare, or (b) have an intermediate build step that bundles the dispatcher with the dist imports inlined.

Option (a) is simpler. Update `packages/cloudflare/src/worker.ts` to import the built bundles:

```ts
// @ts-expect-error - built at dist/admin/rsc/index.js by vite.admin.ts
import adminHandler from "../dist/admin/rsc/index.js";
// @ts-expect-error - built at dist/public/rsc/index.js by vite.public.ts
import publicHandler from "../dist/public/rsc/index.js";
```

That reverts my "no dist imports" claim slightly — but the imports are inside the host package's OWN output path, not a cross-package pokes-into-dist. Conceptually this is the host consuming its own intermediate artifacts.

- [ ] **Step 2: Update `packages/cloudflare/src/worker.ts`**

Replace the workspace imports with dist-relative imports:

```ts
// @ts-expect-error - built artifact at dist/admin/rsc/index.js (see vite.admin.ts)
import adminHandler from "../dist/admin/rsc/index.js";
// @ts-expect-error - built artifact at dist/public/rsc/index.js (see vite.public.ts)
import publicHandler from "../dist/public/rsc/index.js";
import { runWithEnv } from "@wedding/shared/server/context";

// ... rest unchanged
```

- [ ] **Step 3: Run the orchestrator**

```bash
cd packages/cloudflare
pnpm exec tsx build.ts
ls -la dist/client dist/admin/rsc dist/public/rsc
```

Expected:
- `dist/client/` has the public site's client bundle at root + admin's under `admin/`.
- `dist/admin/rsc/index.js` and `dist/public/rsc/index.js` exist.

- [ ] **Step 4: Dry-run wrangler to confirm it can resolve the worker + assets**

```bash
pnpm exec wrangler dev --dry-run 2>&1 | head -30
```

Expected: no errors resolving `main` or `[assets]`.

- [ ] **Step 5: Commit**

```bash
git add packages/cloudflare/build.ts packages/cloudflare/src/worker.ts
git commit -m "Add build orchestrator and wire dispatcher to prod RSC bundles"
```

---

### Task 5.7: Rewrite `node-server.ts` for the dispatcher

The Node deploy path currently imports `createRscHandler` + `runWithEnv` from `../dist/rsc/index.js` and mounts a single `/@rsc/` handler. The new dispatcher has two prefixes. Update node-server to call the dispatcher directly:

**Files:**
- Modify: `packages/cloudflare/src/node-server.ts`

- [ ] **Step 1: Rewrite**

```ts
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createRequestListener } from "@remix-run/node-fetch-server";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { Database as DbSchema } from "@wedding/shared/server/lib/schema";
// @ts-expect-error built artifact, no types
import dispatcher from "../dist/worker.js";

const CLIENT_DIR = resolve(import.meta.dirname, "..", "dist/client");
const PORT = Number(process.env.PORT ?? 3000);

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  try {
    const entries = readdirSync(dir);
    const match = entries.find((e) => e.endsWith(".sqlite") && e !== "metadata.sqlite");
    if (match) return `${dir}/${match}`;
  } catch {
    /* fall through */
  }
  throw new Error(
    "No local D1 SQLite file found. Run `pnpm db:migrate:local` first, or set SQLITE_PATH."
  );
}

const sqlitePath = resolveSqlitePath();
const sqliteDb = new Database(sqlitePath);
const localKyselyDb = new Kysely<DbSchema>({
  dialect: new SqliteDialect({ database: sqliteDb }),
});

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

async function serveStatic(pathname: string): Promise<Response | null> {
  const safe = pathname.replace(/\?.*$/, "").replace(/^\/+/, "");
  const filePath = join(CLIENT_DIR, safe || "index.html");
  if (filePath !== CLIENT_DIR && !filePath.startsWith(CLIENT_DIR + "/")) return null;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    const buf = await readFile(filePath);
    return new Response(buf, {
      headers: { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" },
    });
  } catch {
    return null;
  }
}

// Build a fake `env` matching the Worker contract. ASSETS is implemented as a
// static-file reader.
const env = {
  DB: localKyselyDb,
  ASSETS: {
    async fetch(request: Request | string): Promise<Response> {
      const url = new URL(typeof request === "string" ? request : request.url);
      const file = await serveStatic(url.pathname);
      if (file) return file;
      return new Response("not found", { status: 404 });
    },
  },
};

const listener = createRequestListener(async (request) =>
  dispatcher.fetch(request, env),
);

createServer(listener).listen(PORT, () => {
  console.log(`Serving on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/cloudflare/src/node-server.ts
git commit -m "Update node-server to call the dispatcher"
```

---

## Phase 6 — Tests, root scripts, CI

### Task 6.1: Update `vitest.config.ts` includes

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update to include the new package paths**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    testTimeout: 60_000,
  },
})
```

Removed:
- The `@shared` alias (gone since Phase 2).
- `functions/**`, `shared/**`, `src/**` include patterns (those dirs no longer exist).

- [ ] **Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "Update vitest include paths for workspace layout"
```

---

### Task 6.2: Rewrite `admin-auth.test.ts` for per-package handler

The old test exercised the allowlist-based `createRscHandler(authorize)` pattern. After the restructure there's no allowlist; auth is baked into `packages/admin/src/server/rsc-entry.ts`. Rewrite the test to verify the admin entry rejects unauth prod-like requests and accepts localhost ones.

**Files:**
- Modify: `tests/e2e/admin-auth.test.ts`

- [ ] **Step 1: Rewrite**

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { createServer, isRunnableDevEnvironment, type ViteDevServer } from "vite";

let server: ViteDevServer;
let adminEntry: { fetch: (req: Request, env: unknown) => Promise<Response> };
let adminActionId: string;

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc;
  if (!isRunnableDevEnvironment(env)) {
    throw new Error("rsc environment is not runnable");
  }
  return (await env.runner.import(id)) as T;
}

function extractActionId(fn: unknown): string {
  if (typeof fn !== "function") throw new Error("not a function");
  const id = (fn as { $$id?: unknown }).$$id;
  if (typeof id !== "string" || !id.includes("#")) {
    throw new Error(`server function missing $$id; got ${String(id)}`);
  }
  return id;
}

beforeAll(async () => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  server = await createServer({
    configFile: "./packages/cloudflare/vite.dev.ts",
    server: { port, strictPort: false, host: "127.0.0.1" },
    appType: "custom",
  });
  await server.listen();

  const mod = await loadRscModule<{ default: typeof adminEntry }>(
    "/packages/admin/src/server/rsc-entry.ts",
  );
  adminEntry = mod.default;

  const eventsMod = await loadRscModule<typeof import("../../packages/admin/src/server/events")>(
    "/packages/admin/src/server/events.ts",
  );
  adminActionId = extractActionId(eventsMod.listEvents);
}, 60_000);

afterAll(async () => {
  await server?.close();
});

test("admin RSC entry rejects non-local request without Access JWT (401)", async () => {
  const res = await adminEntry.fetch(
    new Request(`https://wedding.example.com/@rsc-admin/${encodeURIComponent(adminActionId)}`, {
      method: "POST",
    }),
    { ACCESS_AUD: "unset", ACCESS_TEAM_DOMAIN: "unset" },
  );
  expect(res.status).toBe(401);
});

test("admin RSC entry allows localhost request without Access JWT", async () => {
  // No auth required on localhost (dev bypass). Missing body will fail the
  // decodeReply call, but that's past the auth gate — any status other than
  // 401 proves the auth gate was bypassed.
  let status: number | null = null;
  try {
    const res = await adminEntry.fetch(
      new Request(`http://localhost/@rsc-admin/${encodeURIComponent(adminActionId)}`, {
        method: "POST",
      }),
      {},
    );
    status = res.status;
  } catch {
    status = null;
  }
  expect(status).not.toBe(401);
});

test("admin RSC entry rejects unknown action id with 403", async () => {
  const res = await adminEntry.fetch(
    new Request(`http://localhost/@rsc-admin/${encodeURIComponent("fake#id")}`, {
      method: "POST",
    }),
    {},
  );
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: Run just this test**

```bash
pnpm exec vitest run tests/e2e/admin-auth.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-auth.test.ts
git commit -m "Rewrite admin-auth test for per-package RSC entry"
```

---

### Task 6.3: Update `rpc.roundtrip.test.ts` for new layout

**Files:**
- Modify: `tests/e2e/rpc.roundtrip.test.ts`

- [ ] **Step 1: Update config path and RSC handler loader**

Two key changes:
1. `configFile: "./vite.config.node.ts"` → `configFile: "./packages/cloudflare/vite.dev.ts"`. The dev config is the unified one we control.
2. The handler used to come from `createRscHandler()` (returning a single /@rsc/ handler). Now each leaf has its own default-exported `{ fetch }`. The test should load the admin entry to test admin RPC and the public entry to test public RPC, OR load the dev dispatcher directly.

Use the dev dispatcher (`/packages/cloudflare/src/worker-dev.ts`) so the test mirrors real dev behavior.

Full rewrite:

```ts
import { afterAll, beforeAll, expect, test } from "vitest";
import { readdirSync } from "node:fs";
import { createServer, isRunnableDevEnvironment, type ViteDevServer } from "vite";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { createRequestListener } from "@remix-run/node-fetch-server";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database as DbSchema } from "@wedding/shared/server/lib/schema";

let server: ViteDevServer;
let baseUrl: string;
let sqliteDb: Database.Database;
let localKyselyDb: Kysely<DbSchema>;

async function getEncodeReply(): Promise<(args: unknown[]) => Promise<BodyInit>> {
  const mod: { encodeReply: (args: unknown[]) => Promise<BodyInit> } =
    await import("@vitejs/plugin-rsc/vendor/react-server-dom/client.edge");
  return mod.encodeReply;
}

function resolveSqlitePath(): string {
  if (process.env.SQLITE_PATH) return process.env.SQLITE_PATH;
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const entries = readdirSync(dir);
  const match = entries.find((e) => e.endsWith(".sqlite") && e !== "metadata.sqlite");
  if (!match) throw new Error("no local D1 sqlite file; run pnpm db:migrate:local");
  return `${dir}/${match}`;
}

async function loadRscModule<T = unknown>(id: string): Promise<T> {
  const env = server.environments.rsc;
  if (!isRunnableDevEnvironment(env)) throw new Error("rsc environment is not runnable");
  return (await env.runner.import(id)) as T;
}

beforeAll(async () => {
  sqliteDb = new Database(resolveSqlitePath());
  localKyselyDb = new Kysely<DbSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });

  const port = 20000 + Math.floor(Math.random() * 20000);
  server = await createServer({
    configFile: "./packages/cloudflare/vite.dev.ts",
    server: { port, strictPort: false, host: "127.0.0.1" },
    appType: "custom",
  });
  await server.listen();
  const addr = server.httpServer!.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const devMod = await loadRscModule<{
    default: { fetch: (req: Request, env: unknown) => Promise<Response> };
  }>("/packages/cloudflare/src/worker-dev.ts");
  const dispatcher = devMod.default;

  const fakeEnv = {
    DB: localKyselyDb,
    ASSETS: { fetch: async () => new Response("not found", { status: 404 }) },
  };

  const listener = createRequestListener(async (request) => {
    try {
      return await dispatcher.fetch(request, fakeEnv);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[test dev dispatcher error]", e);
      const msg = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
      return new Response(msg, { status: 500 });
    }
  });

  server.middlewares.use(
    (req: IncomingMessage, res: ServerResponse, next) => {
      if (!(req.url?.startsWith("/@rsc-admin/") || req.url?.startsWith("/@rsc-public/"))) {
        return next();
      }
      Promise.resolve(listener(req, res)).catch(next);
    },
  );
}, 60_000);

afterAll(async () => {
  await server?.close();
  sqliteDb?.close();
});

function extractActionId(fn: unknown): string {
  if (!fn || typeof fn !== "function") throw new Error("not a function");
  const id = (fn as { $$id?: unknown }).$$id;
  if (typeof id !== "string" || !id.includes("#")) {
    throw new Error(`server function missing $$id; got ${String(id)}`);
  }
  return id;
}

test("public RPC: lookupGuests returns 200 with non-empty body", async () => {
  const mod = await loadRscModule<typeof import("../../packages/public/src/server/rsvp")>(
    "/packages/public/src/server/rsvp.ts",
  );
  const id = extractActionId(mod.lookupGuests);

  const encodeReply = await getEncodeReply();
  const body = await encodeReply(["kavari"]);
  const res = await fetch(`${baseUrl}/@rsc-public/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "rsc-action-id": id },
    body: body as BodyInit,
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`expected 200, got ${res.status}: ${text}`);
  }
  expect(res.status).toBe(200);
  expect((await res.text()).length).toBeGreaterThan(0);
});

test("unknown public action id returns 403", async () => {
  const encodeReply = await getEncodeReply();
  const body = await encodeReply([]);
  const fakeId = "deadbeef#nothing";
  const res = await fetch(`${baseUrl}/@rsc-public/${encodeURIComponent(fakeId)}`, {
    method: "POST",
    headers: { "rsc-action-id": fakeId },
    body: body as BodyInit,
  });
  expect(res.status).toBe(403);
});

test("admin RPC on localhost returns 200 (no Access header needed)", async () => {
  const mod = await loadRscModule<typeof import("../../packages/admin/src/server/events")>(
    "/packages/admin/src/server/events.ts",
  );
  const id = extractActionId(mod.listEvents);

  const encodeReply = await getEncodeReply();
  const body = await encodeReply([]);
  const res = await fetch(`${baseUrl}/@rsc-admin/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "rsc-action-id": id },
    body: body as BodyInit,
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`expected 200, got ${res.status}: ${text}`);
  }
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run this test**

```bash
pnpm exec vitest run tests/e2e/rpc.roundtrip.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/rpc.roundtrip.test.ts
git commit -m "Update rpc roundtrip test to dev dispatcher + split prefixes"
```

---

### Task 6.4: Update `feature-parity.test.ts` paths

**Files:**
- Modify: `tests/e2e/feature-parity.test.ts`

- [ ] **Step 1: Update config path + module specifiers**

Replace:
```
"./vite.config.node.ts"             →  "./packages/cloudflare/vite.dev.ts"
"/src/server/context.ts"            →  "@wedding/shared/server/context" (type only) — DON'T change the runner import; it still loads by path. Use "/packages/shared/src/server/context.ts"
"/src/server/public/rsvp.ts"        →  "/packages/public/src/server/rsvp.ts"
"/src/server/admin/events.ts"       →  "/packages/admin/src/server/events.ts"
"/src/server/admin/groups.ts"       →  "/packages/admin/src/server/groups.ts"
"/src/server/admin/guests.ts"       →  "/packages/admin/src/server/guests.ts"
"/src/server/admin/import.ts"       →  "/packages/admin/src/server/import.ts"
"/src/server/admin/responses.ts"    →  "/packages/admin/src/server/responses.ts"
```

Type-only imports at the top of the file similarly shift:
```
"../../src/server/context"              →  "../../packages/shared/src/server/context"
"../../src/server/public/rsvp"          →  "../../packages/public/src/server/rsvp"
"../../src/server/admin/events"         →  "../../packages/admin/src/server/events"
"../../src/server/admin/groups"         →  "../../packages/admin/src/server/groups"
"../../src/server/admin/guests"         →  "../../packages/admin/src/server/guests"
"../../src/server/admin/import"         →  "../../packages/admin/src/server/import"
"../../src/server/admin/responses"      →  "../../packages/admin/src/server/responses"
"../../src/server/lib/schema"           →  "../../packages/shared/src/server/lib/schema"
```

- [ ] **Step 2: Run it**

```bash
pnpm exec vitest run tests/e2e/feature-parity.test.ts
```

Expected: 12 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/feature-parity.test.ts
git commit -m "Update feature-parity test paths to workspace layout"
```

---

### Task 6.5: Root `package.json` — slim to workspace root + proxy scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Rewrite**

Move runtime deps to leaf packages (already declared there); keep only root-wide tooling. Root scripts proxy to the cloudflare package for dev/build/deploy:

```json
{
  "name": "wedding.kavari-searls.net",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @wedding/cloudflare dev",
    "build": "pnpm --filter @wedding/cloudflare build",
    "preview": "pnpm --filter @wedding/cloudflare preview",
    "deploy": "pnpm --filter @wedding/cloudflare deploy",
    "start": "pnpm build && node --experimental-strip-types packages/cloudflare/src/node-server.ts",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply DB --local --config packages/cloudflare/wrangler.toml",
    "db:migrate:prod": "wrangler d1 migrations apply DB --remote --config packages/cloudflare/wrangler.toml",
    "db:console:local": "wrangler d1 execute DB --local --config packages/cloudflare/wrangler.toml --command",
    "db:console:prod": "wrangler d1 execute DB --remote --config packages/cloudflare/wrangler.toml --command"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^24.10.1",
    "@types/papaparse": "^5.3.15",
    "@types/react": "^19.2.5",
    "@types/react-dom": "^19.2.3",
    "eslint": "^9.39.1",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "prettier": "^3.8.1",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.46.4",
    "vitest": "^3.2.4",
    "wrangler": "^4.83.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "esbuild", "sharp", "workerd"]
  }
}
```

Notes:
- `db:*` scripts explicitly pass `--config packages/cloudflare/wrangler.toml` because wrangler.toml moved.
- `start` points at the moved node-server.ts.
- `preview` and `deploy` must run from the cloudflare package (the filter handles cwd).

- [ ] **Step 2: `pnpm install` to re-link**

```bash
pnpm install
```

Expected: no errors; symlink graph updates.

- [ ] **Step 3: Smoke-test a few commands**

```bash
pnpm lint
pnpm format:check
pnpm test
```

Expected: lint passes, format:check passes, 78/78 tests pass.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Slim root package.json to workspace root + proxy scripts"
```

---

### Task 6.6: Update `tsconfig.json` to use project references

**Files:**
- Modify: `tsconfig.json`
- Delete: `tsconfig.app.json`, `tsconfig.node.json`

- [ ] **Step 1: Rewrite `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/public" },
    { "path": "./packages/admin" },
    { "path": "./packages/cloudflare" }
  ]
}
```

- [ ] **Step 2: Remove obsolete tsconfigs**

```bash
git rm tsconfig.app.json tsconfig.node.json
```

- [ ] **Step 3: Type-check via `tsc`**

```bash
pnpm exec tsc --build
```

Expected: clean. If a package reports errors, fix them inline (most commonly a stale import path or a package missing a `composite: true` flag). For project references, each package's tsconfig needs:

```json
{
  "compilerOptions": {
    "composite": true,
    // ...existing options
  }
}
```

Add `"composite": true` to each package tsconfig if `tsc --build` complains.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json packages/*/tsconfig.json
git commit -m "Use TS project references for workspace packages"
```

---

### Task 6.7: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Update paths**

Key changes:
- D1 migration: pass `--config packages/cloudflare/wrangler.toml`.
- Build: now `pnpm build` (proxies to `@wedding/cloudflare`).
- Deploy: `pnpm --filter @wedding/cloudflare deploy`.
- The `sed` step that injects `CLOUDFLARE_DATABASE_ID` needs to target the moved wrangler.toml.

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v6
        with: { node-version: lts/*, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Provision local D1 sqlite for tests
        run: pnpm exec wrangler d1 migrations apply DB --local --config packages/cloudflare/wrangler.toml

      - run: pnpm test

      - run: pnpm build

      - name: Inject production D1 database_id
        run: |
          if [ -z "${{ secrets.CLOUDFLARE_DATABASE_ID }}" ]; then
            echo "::error::CLOUDFLARE_DATABASE_ID secret is required for deploy."
            exit 1
          fi
          sed -i "s/REPLACE_ME_WITH_REAL_ID/${{ secrets.CLOUDFLARE_DATABASE_ID }}/g" packages/cloudflare/wrangler.toml
          grep database_id packages/cloudflare/wrangler.toml

      - run: pnpm exec wrangler d1 migrations apply DB --remote --config packages/cloudflare/wrangler.toml
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - run: pnpm --filter @wedding/cloudflare deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Update CI workflow for workspace layout"
```

---

### Task 6.8: Update migrations path reference (docs only)

**Files:**
- Check: `README.md`

- [ ] **Step 1: Read `README.md`**

Scan for any references to `vite.config.ts`, `src/worker.ts`, old import paths, or the old `wrangler.toml` location. Update to point at the new paths (e.g., `packages/cloudflare/wrangler.toml`).

- [ ] **Step 2: Commit if changes made**

```bash
git add README.md
git commit -m "Update README for workspace layout"
```

---

## Phase 7 — Final verification

### Task 7.1: Full test sweep

- [ ] **Step 1: Clean and re-migrate local D1**

```bash
rm -rf .wrangler/state
pnpm db:migrate:local
```

- [ ] **Step 2: Run every test**

```bash
pnpm test
```

Expected: 78/78 pass. If fewer tests run than 78, a test file was accidentally deleted — git diff to find.

- [ ] **Step 3: Type check everything**

```bash
pnpm exec tsc --build --clean && pnpm exec tsc --build
```

Expected: clean.

- [ ] **Step 4: Lint**

```bash
pnpm lint
```

Expected: clean.

---

### Task 7.2: Dev server smoke test

- [ ] **Step 1: Start dev**

```bash
pnpm dev
```

Expected: Vite starts on http://localhost:5173.

- [ ] **Step 2: Playwright probe both sides**

In another terminal:

```bash
cd /tmp/pw-debug
# Use the probe.mjs from earlier (the one that captures console errors + 401s).
# Re-point it at both URLs:
URL=http://localhost:5173/admin/groups node probe.mjs | tee /tmp/pw-admin.log
URL=http://localhost:5173/ node probe.mjs | tee /tmp/pw-public.log
```

You may need to update `probe.mjs` to read the URL from an env var — a 2-line change.

Expected:
- Admin probe: body text includes "Wedding Admin" + at least one guest row; no 401s; no "Connection closed."
- Public probe: body includes "Sanam Louise Kavari" + "will be married"; no errors.

- [ ] **Step 3: Kill dev server**

```bash
# Ctrl-C
```

---

### Task 7.3: Prod build + wrangler dry-run

- [ ] **Step 1: Build**

```bash
pnpm build
```

Expected:
- `packages/cloudflare/dist/client/index.html` (public shell)
- `packages/cloudflare/dist/client/admin/index.html` (admin shell)
- `packages/cloudflare/dist/client/assets/*` (bundled JS/CSS)
- `packages/cloudflare/dist/admin/rsc/index.js` (admin RSC bundle)
- `packages/cloudflare/dist/public/rsc/index.js` (public RSC bundle)

- [ ] **Step 2: Wrangler dry-run deploy**

```bash
cd packages/cloudflare
pnpm exec wrangler deploy --dry-run --outdir=/tmp/wrangler-dryrun
ls /tmp/wrangler-dryrun
```

Expected: `worker.js` + no errors. Note any size warnings for info only.

- [ ] **Step 3: Wrangler dev (local prod emulation)**

```bash
pnpm preview
```

Open `http://localhost:8787/admin/groups`. Expected: page loads. Check that the dispatcher routes `/@rsc-admin/*` correctly (there's no Cloudflare Access in front of `wrangler dev`, but admin's localhost bypass kicks in — same as `pnpm dev`).

- [ ] **Step 4: Kill wrangler dev**

---

### Task 7.4: Cloudflare Access dashboard update (manual, non-code)

- [ ] **Step 1: Log into Cloudflare dashboard → Zero Trust → Access → Applications**

- [ ] **Step 2: Find the Access application gating the wedding site**

- [ ] **Step 3: Update the path rules**

If the application currently includes `/@rsc*`, change to `/@rsc-admin*`. Keep `/admin*` if already there; add it if not.

Public paths (`/@rsc-public/*`, `/`, `/rsvp/:code`, static assets) should NOT be in the Access-protected path list — guests must reach them without login.

- [ ] **Step 4: Save the Access app. Test in production after deploy completes.**

---

### Task 7.5: Delete the plan

Once verified end-to-end (admin loads in prod behind Access; public loads for unauth users; tests green in CI; deploy lands):

- [ ] **Step 1: Remove the plan file**

```bash
git rm docs/plans/2026-04-18-workspace-split.md
rmdir docs/plans docs 2>/dev/null || true
git commit -m "Remove completed workspace-split plan"
```

Or keep it under `docs/` as historical record — user preference.

---

## Appendix A — What was removed / changed in spirit

- **Dropped:** the cross-package allowlist pattern (`adminActionIds` / `publicActionIds` in `entry.rsc.ts`). Replaced by structural separation: each leaf's RSC bundle only knows its own actions.
- **Dropped:** the `globalThis.ACCESS_AUD` shim in `worker.ts`. Replaced by env threading through the dispatcher → admin sub-handler.
- **Dropped:** the unified `/@rsc/` URL prefix. Now `/@rsc-admin/` and `/@rsc-public/` — required for Cloudflare Access to path-gate only the admin side.
- **Preserved:** the hostname bypass in admin auth (Fix A from earlier) plus the RSC-client response validation (Fix B). Both now live per-package instead of shared.
- **Preserved:** the `not_found_handling = "none"` + custom SPA fallback in the dispatcher. Same behavior as today — admin sub-routes keep loading the admin shell.
- **Preserved:** Node deploy path (`packages/cloudflare/src/node-server.ts`). Still callable via `pnpm start`.

## Appendix B — What to watch for in the first run-through

- **`import.meta.glob` self-reference:** `./*.ts` inside each rsc-entry picks up the entry itself. The `delete adminModules["./rsc-entry.ts"]` trick handles it; verify the glob result in dev by logging `Object.keys(adminModules)` once.
- **`composite: true` for TS project references:** if `tsc --build` complains, add this to each package's tsconfig.
- **pnpm workspace symlinks vs. vite SSR:** Vite 8 resolves workspace packages via pnpm symlinks automatically. If a server-side import fails with "cannot resolve @wedding/shared", confirm `pnpm install` ran after the last package.json change.
- **`import.meta.resolve` in node:** if you use it (the earlier research sketch did), note it requires Node ≥ 20.6 with `--experimental-import-meta-resolve` on older versions. This plan uses plain workspace imports everywhere, so this shouldn't come up.
- **Cloudflare plugin + two workers in one dev server:** the dev setup uses ONE worker entry (`worker-dev.ts`) that globs both leaves. If `@cloudflare/vite-plugin` chokes on the large union graph (unlikely but possible), split dev into two Vite servers on separate ports (5173 public, 5174 admin) and proxy through a tiny Node dispatcher at 3000.
