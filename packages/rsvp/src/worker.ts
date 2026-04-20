import { createRscHandlers } from 'rsc-utils/functions/server'
import {
  getStaticPaths,
  handleRequest,
} from 'virtual:rsc-utils/static-pages/rsc-entry'
import { functionsConfig } from './rsc-functions'
import { runWithEnv } from './server/shared/context'

export { runWithEnv, getStaticPaths, handleRequest }

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  ACCESS_AUD: string
  ACCESS_TEAM_DOMAIN: string
}

const { handle } = createRscHandlers(functionsConfig)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return runWithEnv(env, async () => {
      const rscResponse = await handle(request)
      if (rscResponse) return rscResponse

      const assetResponse = await env.ASSETS.fetch(request)
      if (assetResponse.status !== 404) return assetResponse

      // In dev, ASSETS.fetch routes back through Vite and won't find
      // the prerendered HTML. Fall back to rendering the page live —
      // cheap on known static paths, a no-op for unknown URLs.
      const url = new URL(request.url)
      const pathname = url.pathname.endsWith('/')
        ? url.pathname
        : `${url.pathname}/`
      if (getStaticPaths().includes(pathname)) {
        const { html } = await handleRequest(
          new Request(new URL(pathname, url.origin), request)
        )
        return new Response(html, {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }

      return assetResponse
    })
  },
} satisfies ExportedHandler<Env>
