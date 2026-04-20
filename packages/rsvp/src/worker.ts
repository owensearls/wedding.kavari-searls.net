import { createRscHandlers } from 'rsc-utils/functions/server'
import { functionsConfig } from './rsc-functions'
import { runWithEnv } from './server/shared/context'

export { runWithEnv }
export {
  getStaticPaths,
  handleRequest,
} from 'virtual:rsc-utils/static-pages/rsc-entry'

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
      return env.ASSETS.fetch(request)
    })
  },
} satisfies ExportedHandler<Env>
