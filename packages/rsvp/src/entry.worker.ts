import { createRscHandlers } from 'rsc-utils/functions/server'
import {
  getStaticPaths,
  handleRequest,
} from 'rsc-utils/static-pages/server'
import { functionsConfig } from './rsc-functions'
import { runWithEnv } from './server/shared/context'

export { getStaticPaths, handleRequest }

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
      const rendered = await handleRequest(request)
      if (!rendered) return new Response('Not Found', { status: 404 })
      return new Response(rendered.html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    })
  },
} satisfies ExportedHandler<Env>
