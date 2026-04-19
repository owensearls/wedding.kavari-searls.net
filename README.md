# Kavari-Searls Wedding

## Local development

- `pnpm install` (native deps: run `pnpm approve-builds` for better-sqlite3 if needed)
- `pnpm db:migrate:local` — apply D1 migrations to local SQLite
- `pnpm run dev` — primary dev: Cloudflare Workers runtime via `@cloudflare/vite-plugin`. Uses miniflare D1.
- `pnpm run dev:node` — alternative: plain Node + local SQLite via better-sqlite3. Useful for on-prem parity.
- `pnpm vitest run` — run tests.
- `pnpm build && pnpm start` — production Node server (serves `dist/client/`, dispatches `/@rsc/*`). No auth — deploy behind a firewall or localhost only.

## Architecture

Two static SPAs are served from this project: `/` (public) and `/admin/` (admin). All server-side logic lives in `"use server"` functions in `src/server/{public,admin}/*.ts` and is invoked via RSC RPC at `/@rsc/<id>`. Public vs. admin identity is determined server-side by matching the incoming action id against allowlists auto-derived from the server modules.

## Admin access

- Cloudflare Access Application covers `/admin/*` at the edge. No unauthenticated user can load the admin SPA.
- Admin RPCs go through the shared `/@rsc/<id>` endpoint and are gated at the Worker by `verifyAccessJwt`, which validates the `Cf-Access-Jwt-Assertion` header.
- Access Application audience (AUD) and team domain are injected as Worker secrets:
  - `ACCESS_AUD` — AUD tag from the Access Application (find in Zero Trust → Access → Applications → [this app] → Overview).
  - `ACCESS_TEAM_DOMAIN` — e.g. `your-team` (NOT `your-team.cloudflareaccess.com`).
- Rotate via `npx wrangler secret put ACCESS_AUD` / `npx wrangler secret put ACCESS_TEAM_DOMAIN`.
- To set up fresh: Zero Trust → Access → Applications → Add an application → Self-hosted. Application domain: `wedding.kavari-searls.net/admin/*`. Add a policy: Action = Allow, Include = Emails of admins.

## Deploying

- Production target: Cloudflare Worker via `wrangler deploy` (CI workflow in `.github/workflows/deploy.yml`).
- `wrangler.toml` `database_id` is a placeholder (`REPLACE_ME_WITH_REAL_ID`) — replace with the real D1 id before first deploy.
- D1 migrations run via `wrangler d1 migrations apply DB --remote`.
