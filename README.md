# Kavari-Searls Wedding

## Local development

- `pnpm install`
- `pnpm db:migrate:local` — apply D1 migrations to local SQLite
- `pnpm run dev` — Cloudflare Workers runtime via `@cloudflare/vite-plugin`. Uses miniflare D1.
- `pnpm vitest run` — run tests.

## Architecture

Two static SPAs are served from this project: `/` (public) and `/admin/` (admin). All server-side logic lives in `"use server"` functions in `src/server/{public,admin}/*.ts` and is invoked via RSC RPC at `/@rsc/<id>`. Public vs. admin identity is determined server-side by matching the incoming action id against allowlists auto-derived from the server modules.

## Admin access

Admin protection is **edge-only** via Cloudflare Access — the worker itself does no auth check. Anything reaching the worker is assumed to be a request that already passed through Access.

- Set up: Zero Trust → Access → Applications → Add an application → Self-hosted. Application domain covers the hostnames where admin should be reachable (e.g. `wedding.kavari-searls.net/admin/*` for production, and the workers.dev preview URLs if you want preview builds gated). Policy: Action = Allow, Include = your admin emails.
- The workers.dev URL bypasses any Access policy that's only attached to the custom domain. Either add an Access Application for the workers.dev hostname too, or set `workers_dev = false` in `packages/rsvp/wrangler.toml` to disable that URL entirely.

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
