# Fix `/admin/` asset routing under run_worker_first

## Root cause

`@cloudflare/vite-plugin` forces the effective assets directory to equal Vite's
client `outDir`. In `packages/rsvp/vite.config.ts:28`, `outDir = 'dist/client/admin'`.
Combined with `base = '/admin/'`, a request for `/admin/index.html` looks up
`dist/client/admin/admin/index.html` — which doesn't exist because the built
files live at the root of `dist/client/admin`, not nested under another `admin/`.

Cloudflare themselves acknowledge in
[workers-sdk#10593](https://github.com/cloudflare/workers-sdk/pull/10593) that
"the `base` option still won't work correctly for Workers with assets" out of
the box. We need to align the filesystem layout with the URL base.

## Fix strategy

Restructure build outputs so `/admin/*` URLs map 1:1 to files on disk.

Change the client `outDir` from `'dist/client/admin'` → `'dist/client'`, and
emit all admin outputs into a nested `admin/` subdirectory inside it. The
plugin will then use `dist/client` as the assets dir, and `/admin/index.html`
→ `dist/client/admin/index.html` ✓.

## Files to change

### 1. `packages/rsvp/vite.config.ts`

- `environments.client.build.outDir`: `'dist/client/admin'` → `'dist/client'`
- Add to `environments.client.build.rolldownOptions.output`:
  - `entryFileNames: 'admin/assets/[name]-[hash].js'`
  - `chunkFileNames: 'admin/assets/[name]-[hash].js'`
  - `assetFileNames: 'admin/assets/[name]-[hash][extname]'`

### 2. `packages/rsc-utils/src/plugins/static-pages/build-orchestrator.ts:23-42`

- Prerendered HTML currently writes to `path.join(baseDir, staticPath)`.
  Prepend Vite's `base` (leading slash stripped) so `base='/admin/'` +
  `staticPath='/'` → `dist/client/admin/index.html`. Same for the `.rsc`
  sidecar.
- Pass `config.base` through to the orchestrator (already has `ResolvedConfig`).

### 3. `packages/rsvp/public/` — relocate at build time

- Vite copies `publicDir` contents to `<outDir>/` root by default. With
  `outDir='dist/client'` they'd land at `dist/client/favicon.svg` but HTML
  references `/admin/favicon.svg`.
- Fix with a small `closeBundle` plugin in `vite.config.ts` that moves public
  assets into `dist/client/admin/` after build. Or simpler: set
  `publicDir: false` and add an explicit copy step. The closeBundle plugin is
  ~10 lines and keeps everything in the vite config.

### 4. `packages/rsvp/wrangler.toml`

No change. `directory = "./dist/client"` already matches the new outDir.

## Verification sequence

- `pnpm --filter rsvp build` — confirm `dist/client/admin/index.html`,
  `dist/client/admin/assets/*`, `dist/client/admin/events/index.html`, etc.
  exist.
- `pnpm --filter rsvp preview` — hit `/admin/`, `/admin/events/`,
  `/admin/import/`, `/admin/@rsc-admin/...` (POST), `/@rsc-public/...` (POST).
  All should 200. A random `/admin/typo` should 404 without invoking the Worker.
- `pnpm --filter rsvp test` — unchanged, 31 pass.
- `pnpm -r typecheck` — green.

## What this deliberately does not do

- Does not restore `serveStaticPage` or any dev-only fallback in the prod Worker
  handler.
- Does not change `run_worker_first`. Only RSC endpoints hit the Worker.
- Does not address `pnpm dev` — that's a separate fix (the dev-middleware
  can't invoke the worker-owned rsc environment). This plan keeps dev broken
  for `/admin/` but makes prod correct, which is the priority.

## Risks / things to watch

- The `.rsc` sidecar files (used for client-side RSC navigation) need the same
  path prefix — covered in step 2.
- Any hardcoded reference to `dist/client/admin` elsewhere in the repo. Grep
  before changing.
- The rsc-utils change is in a shared package — the frontend package also uses
  `rscStaticPages` but at `base: '/'`, so prefixing by base should be a no-op
  there. Verify.
