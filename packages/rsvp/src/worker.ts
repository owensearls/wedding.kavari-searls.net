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
