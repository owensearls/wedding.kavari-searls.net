# Kavari-Searls Wedding

## Local development

- `pnpm install`
- `pnpm db:migrate:local` — apply D1 migrations to local SQLite
- `pnpm run dev` — Cloudflare Workers runtime via `@cloudflare/vite-plugin`. Uses miniflare D1.
- `pnpm vitest run` — run tests.

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

## CI / CD

Three GitHub Actions workflows:

- **`check.yml`** — runs on every PR and push to `main`: `lint`, `format:check`, `typecheck`, `test`, `build` in parallel.
- **`deploy.yml`** — triggers on successful `Check` completion on `main` (via `workflow_run`). Applies D1 migrations, then deploys both workers (`rsvp` and `frontend`).
- **`preview.yml`** — runs on PRs from same-repo branches. `wrangler versions upload --preview-alias pr-<n>` for each worker; sticky-comments the preview URLs on the PR. Skipped for forks.

Required GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — scoped token with `Workers Scripts:Edit` and `D1:Edit`.
- `CLOUDFLARE_ACCOUNT_ID`.

The D1 `database_id` is committed in `packages/{rsvp,frontend}/wrangler.toml`. Both workers point at the same D1 (account-scoped, `database_name = "wedding"`); migrations live in `packages/rsvp/migrations/` and only the `rsvp` workflow step applies them. Until the placeholder `REPLACE_ME_WITH_REAL_ID` is replaced with a real id (`wrangler d1 list`), the Deploy and Preview workflows fail; Check still passes.

To deploy manually from a developer machine: `pnpm install && pnpm build && pnpm --filter rsvp exec wrangler d1 migrations apply DB --remote && pnpm --filter rsvp exec wrangler deploy && pnpm --filter frontend exec wrangler deploy`.
