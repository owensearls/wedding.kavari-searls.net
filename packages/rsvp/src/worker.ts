import { createRscHandler } from './entry.rsc'
import { verifyAccessJwt } from './server/shared/auth'
import { runWithEnv } from './server/shared/context'

// Re-export so the Node production server can reach the un-bundled helpers
// via the built `dist/rsc/index.js` (which inlines virtual RSC modules).
export { createRscHandler, runWithEnv }
export { getStaticPaths, handleSsg } from './entry.rsc'

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ACCESS_AUD: string
  ACCESS_TEAM_DOMAIN: string
}

// Loopback hostnames can only be reached in local dev: Cloudflare won't route
// a request whose URL hostname is localhost to a deployed Worker, so this is
// safe to treat as a trusted-dev signal without any config flag.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

// TODO(task-7): replace this globalThis shim by extending runWithEnv's env
// object so verifyAccessJwt reads from getEnv() instead of globals.
const accessGlobals = globalThis as unknown as {
  ACCESS_AUD?: string
  ACCESS_TEAM_DOMAIN?: string
}

const handler = createRscHandler(async (request) => {
  // Runs only for action ids in the admin allowlist (see entry.rsc.ts).
  // Verifies the Cloudflare Access JWT injected at the edge.
  if (LOCAL_HOSTNAMES.has(new URL(request.url).hostname)) return null
  const ok = await verifyAccessJwt(request, {
    aud: accessGlobals.ACCESS_AUD ?? '',
    teamDomain: accessGlobals.ACCESS_TEAM_DOMAIN ?? '',
  })
  return ok ? null : new Response('Unauthorized', { status: 401 })
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/@rsc/')) {
        // Access config values live on env, not globals — forward via closure.
        accessGlobals.ACCESS_AUD = env.ACCESS_AUD
        accessGlobals.ACCESS_TEAM_DOMAIN = env.ACCESS_TEAM_DOMAIN
        return handler(request)
      }
      // Serve static assets; if 404, SPA-fallback to the single shell.
      // Wrangler's built-in SPA fallback is disabled in wrangler.toml so the
      // RSC handler branch above can own the /@rsc/ path; the fallback itself
      // is a straightforward re-fetch of the root index.html.
      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) return assetResponse

      const shellUrl = new URL('/', url)
      return env.ASSETS.fetch(new Request(shellUrl, request))
    })
  },
} satisfies ExportedHandler<Env>
