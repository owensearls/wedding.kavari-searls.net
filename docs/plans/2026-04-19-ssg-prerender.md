# Prerender via @vitejs/plugin-rsc SSG

## Context

`dist/client/index.html` is a 780-byte shell with one `<script>` tag that loads `src/main.tsx`. First paint requires a round-trip, a JS parse, and a React mount before any content appears. Prerender the landing HTML at build time so visitors receive content immediately and the app hydrates on top.

`@vitejs/plugin-rsc` (0.5.24, already installed) ships an official SSG example at [vitejs/vite-plugin-react/packages/plugin-rsc/examples/ssg](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc/examples/ssg). The plugin provides RSC + SSR render primitives; userland code wires three entries (client / rsc / ssr) plus a Vite plugin that runs a build-time render loop.

## Build topology

```
vite build:
  plugin-rsc builds 3 envs → client/, rsc/, ssr/ bundles
  rscSsgPlugin.buildApp hook (post-build):
    1. imports compiled rsc/index.js (worker bundle — see "Module boundaries")
    2. getStaticPaths() → ['/']
    3. for each path, handleSsg(new Request('http://ssg.local<path>')):
       - renders <Root url /> as RSC payload via renderToReadableStream
       - tees stream; one half → ssr env's renderHtml → HTML stream
       - renderHtml injects bootstrap <script> via loadBootstrapScriptContent('index')
         and pipes through injectRSCPayload from rsc-html-stream/server
    4. writes dist/client/<path>/index.html (or index.html for '/')
       + dist/client/<path>_.rsc sidecar
```

## Module boundaries

`src/entry.rsc.tsx` stays platform-independent: it owns `createRscHandler` (the existing RSC action plumbing) and gains the SSG functions (`handleSsg`, plus a re-export of `getStaticPaths` from `./root`). It knows nothing about Cloudflare.

`src/worker.ts` stays the Cloudflare entrypoint. It already imports from `entry.rsc`; it gains a one-line re-export so the compiled rsc bundle exposes `getStaticPaths`/`handleSsg` alongside the existing `default` ExportedHandler:

```ts
export { getStaticPaths, handleSsg } from './entry.rsc'
```

`vite.config.ts`'s rsc entry stays `./src/worker.ts`. Cloudflare finds `default`; the ssg-plugin finds the named exports — same bundle, distinct roles.

## Files

### New

| Path | Purpose |
|---|---|
| `src/root.tsx` | Server component. Returns `<html lang="en"><head>…favicon, viewport, title, og tags…</head><body><div id="root"><App /></div></body></html>` (head content ported from `index.html`). Exports `async getStaticPaths(): Promise<string[]>` returning `['/']`. |
| `src/entry.ssr.tsx` | Exports `renderHtml(rscStream, { ssg })`. Resolves `bootstrapScriptContent` via `import.meta.viteRsc.loadBootstrapScriptContent('index')`. Uses `prerender` from `react-dom/static.edge` when `ssg: true`, `renderToReadableStream` from `react-dom/server.edge` otherwise. Pipes through `injectRSCPayload` from `rsc-html-stream/server`. |
| `src/framework/ssg-plugin.ts` | `rscSsgPlugin()` Vite plugin adapted from the official example. `config` hook sets `appType: 'mpa'` + `rsc.serverHandler: false` during preview. `buildApp` hook imports the compiled rsc entry, loops `getStaticPaths()`, calls `handleSsg`, writes HTML and RSC files to `dist/client/`. |

### Modified

| Path | Change |
|---|---|
| `src/entry.rsc.ts` → `src/entry.rsc.tsx` | Rename (needs JSX for the SSG functions). Keep existing `createRscHandler` export. Import `{ Root, getStaticPaths } from './root'`; re-export `getStaticPaths`. Add `handleSsg(request)`: build `{ root: <Root url={new URL(request.url)} /> }`, render with `renderToReadableStream` from `@vitejs/plugin-rsc/rsc`, tee, pass one half to the ssr env via `import.meta.viteRsc.loadModule('ssr', 'index')`, return `{ html, rsc }` streams. |
| `src/worker.ts` | Add `export { getStaticPaths, handleSsg } from './entry.rsc'`. Existing import path already works with the `.tsx` extension. Default ExportedHandler unchanged. |
| `src/main.tsx` | `createRoot(...)` → `hydrateRoot(...)` so the prerendered DOM hydrates in place. |
| `src/App.tsx` | Add `'use client'` at top. `<App />` is rendered inside Root on the server; the directive marks it as a client component so its hooks/interactivity activate on hydration. |
| `vite.config.ts` | Add `client` and `ssr` entries to the existing `rsc()` plugin call: `entries: { client: './src/main.tsx', rsc: './src/worker.ts', ssr: './src/entry.ssr.tsx' }`. Keep `serverHandler: false`. Append `rscSsgPlugin()` to the plugin array. |

### Deleted

- `index.html` — replaced by the build-time output of `src/root.tsx`.

### Added dependency

- `rsc-html-stream@^0.0.7` — `injectRSCPayload` (server) and the client-side `rscStream` consumer.

## Step-by-step implementation order

1. Install `rsc-html-stream`.
2. Add `'use client'` to `src/App.tsx`. Verify `pnpm dev` still runs. Commit.
3. Rename `src/entry.rsc.ts` → `src/entry.rsc.tsx`. Confirm build still works (no new exports yet). Commit.
4. Add `src/root.tsx` — port head contents from `index.html` into JSX; render `<App />` inside `<div id="root">`; export `getStaticPaths`. Commit.
5. Add `src/entry.ssr.tsx`. Commit.
6. Extend `src/entry.rsc.tsx` with `handleSsg` + re-exported `getStaticPaths`. Commit.
7. Add `export { getStaticPaths, handleSsg } from './entry.rsc'` to `src/worker.ts`. Commit.
8. Add `src/framework/ssg-plugin.ts`. Commit.
9. Update `vite.config.ts`: add `client` + `ssr` entries to `rsc()`; append `rscSsgPlugin()`. Commit.
10. Change `src/main.tsx`: `createRoot` → `hydrateRoot`. Commit.
11. Delete `index.html`. Commit.
12. Run verification.

## Verification

1. `pnpm build` succeeds; `dist/client/index.html` exists and exceeds ~1 KB.
2. `grep -c "Sanam Louise Kavari" dist/client/index.html` ≥ 1.
3. `grep -c "<title>Kavari-Searls Wedding" dist/client/index.html` ≥ 1.
4. `dist/client/_.rsc` exists.
5. `pnpm preview`, open `/` with JS disabled — landing content and title render from the prerendered HTML.
6. Re-enable JS, reload `/` — no hydration warnings in console; page is interactive.
7. `pnpm test` green.

## Rollback

Each numbered step is a separate commit. Revert individual steps as needed.
