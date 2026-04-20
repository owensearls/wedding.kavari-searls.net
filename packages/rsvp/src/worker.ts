import { createRscHandlers } from 'rsc-utils/functions/server'
import { functionsConfig } from './rsc-functions'
import { runWithEnv } from './server/shared/context'

export { runWithEnv }
export { getStaticPaths } from 'virtual:rsc-utils/ssg-entry'
export { handleSsg } from './ssg-entry'

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

      const shellUrl = new URL('/', request.url)
      return env.ASSETS.fetch(new Request(shellUrl, request))
    })
  },
} satisfies ExportedHandler<Env>
