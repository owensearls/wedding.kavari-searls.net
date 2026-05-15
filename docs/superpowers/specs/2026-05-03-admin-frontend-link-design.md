# Admin → Frontend Deep-Link Fix

Admin (rsvp worker) links to user-facing RSVP pages (frontend worker) via relative `/rsvp/${inviteCode}` hrefs in `packages/rsvp/src/admin/routes/GuestDetailModal.tsx:55` and `packages/rsvp/src/admin/routes/GroupBlock.tsx:60`. With the workers split across hosts, those resolve to the rsvp host instead of the frontend.

Fix: introduce a build-time env var `VITE_FRONTEND_URL` consumed by the admin client bundle, set per environment.

## Approach

Replace the two relative hrefs with `${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(code)}`. Vite inlines the var into the admin JS bundle at build time. Each environment supplies the value before `vite build` runs.

## Per-environment configuration

**Local dev** — commit `packages/rsvp/.env.development`:

```
VITE_FRONTEND_URL=http://localhost:5174
```

Vite loads `.env.development` automatically when running `pnpm --filter rsvp dev`. Frontend dev server is pinned to 5174 in `packages/frontend/vite.config.ts`.

**Production CI** (`.github/workflows/deploy.yml`) — set on the rsvp deploy step:

```yaml
- name: Deploy rsvp worker
  env:
    VITE_FRONTEND_URL: https://wedding.kavari-searls.net
  run: pnpm --filter rsvp run deploy
```

`predeploy` runs `pnpm --filter 'rsvp...' build`, which inherits the step's env, so the var reaches `vite build`.

**Preview CI** (`.github/workflows/preview.yml`) — restructure to upload frontend first, capture its URL, then build + upload rsvp with that URL:

```yaml
- run: pnpm --filter rsc-utils build
- run: pnpm --filter frontend build
- id: frontend
  name: Upload frontend preview
  run: |
    set -o pipefail
    pnpm --filter frontend exec wrangler versions upload -c dist/rsc/wrangler.json --preview-alias "$ALIAS" 2>&1 | tee /tmp/frontend.log
    URL=$(grep -oE 'https://[A-Za-z0-9.-]+\.workers\.dev' /tmp/frontend.log | head -1)
    echo "url=$URL" >> "$GITHUB_OUTPUT"
- name: Build rsvp with frontend URL
  env:
    VITE_FRONTEND_URL: ${{ steps.frontend.outputs.url }}
  run: pnpm --filter rsvp build
- id: rsvp
  name: Upload rsvp preview
  run: |
    set -o pipefail
    pnpm --filter rsvp exec wrangler versions upload -c dist/rsc/wrangler.json --preview-alias "$ALIAS" 2>&1 | tee /tmp/rsvp.log
    URL=$(grep -oE 'https://[A-Za-z0-9.-]+\.workers\.dev' /tmp/rsvp.log | head -1)
    echo "url=$URL" >> "$GITHUB_OUTPUT"
```

This avoids hardcoding the account `workers.dev` subdomain — we read the actual deployed frontend URL from the upload log and feed it into the rsvp build.

## Type declaration

Extend `packages/rsvp/src/vite-env.d.ts` (or create it) with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FRONTEND_URL: string
}
```

So `import.meta.env.VITE_FRONTEND_URL` is typed in admin code.

## Code changes

`packages/rsvp/src/admin/routes/GuestDetailModal.tsx:55`:

```tsx
href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(data.inviteCode)}`}
```

`packages/rsvp/src/admin/routes/GroupBlock.tsx:60`:

```tsx
href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(guest.inviteCode)}`}
```

## Failure mode

If `VITE_FRONTEND_URL` is unset at build time, `import.meta.env.VITE_FRONTEND_URL` is `undefined`, producing `undefined/rsvp/CODE` hrefs — visibly broken and obviously wrong, easy to spot. The `.env.development` file ensures local builds always have a value; CI explicitly sets it.

## Out of scope

- The admin worker's own custom domain (still TBD per Owen's note). Whichever hostname admin ends up on, it points at `wedding.kavari-searls.net` for the production frontend link regardless.
- Other admin links (only the two `/rsvp/${code}` hrefs need this — admin's own internal nav stays relative).
