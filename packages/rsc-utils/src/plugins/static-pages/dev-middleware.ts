import { Readable } from 'node:stream'
import type { ViteDevServer } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import type { PageEntry } from './page-discovery.js'
import { RSC_ENTRY_ID } from './virtual-modules.js'

type RscEntry = {
  handleRequest: (request: Request) => Promise<{
    html: ReadableStream<Uint8Array>
    rsc: ReadableStream<Uint8Array>
  }>
}

export function installDevMiddleware(
  server: ViteDevServer,
  getPages: () => PageEntry[]
): void {
  server.middlewares.use(async (req, res, next) => {
    if (req.method !== 'GET') return next()
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)

    const pages = getPages()
    const match = pages.find(
      (p) => p.pathname === url.pathname || p.pathname === url.pathname + '/'
    )
    if (!match) return next()

    const rscEnv = server.environments.rsc
    if (!rscEnv || !isRunnableDevEnvironment(rscEnv)) return next()

    try {
      const mod = (await rscEnv.runner.import(RSC_ENTRY_ID)) as RscEntry
      const request = new Request(
        new URL(match.pathname, `http://${host}`),
        { method: 'GET' }
      )
      const { html } = await mod.handleRequest(request)
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      Readable.fromWeb(html as Parameters<typeof Readable.fromWeb>[0]).pipe(
        res
      )
    } catch (err) {
      server.ssrFixStacktrace(err as Error)
      next(err)
    }
  })
}
