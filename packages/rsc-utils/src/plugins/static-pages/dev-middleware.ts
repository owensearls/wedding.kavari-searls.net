import { Readable } from 'node:stream'
import type { ViteDevServer } from 'vite'
import { isRunnableDevEnvironment } from 'vite'
import type { PageEntry } from './page-discovery.js'
import { RSC_ENTRY_ID } from './virtual-modules.js'

type IncomingMessageLike = { url?: string }

type RenderResult = {
  html: ReadableStream<Uint8Array>
  rsc: ReadableStream<Uint8Array>
}

type RscEntry = {
  handleRequest: (request: Request) => Promise<RenderResult | null>
}

export function installDevMiddleware(
  server: ViteDevServer,
  getPages: () => PageEntry[],
  getBase: () => string
): void {
  // Plugin-rsc registers its loadModuleDevProxy handler at
  // /__vite_rsc_load_module_dev_proxy, but its RPC client derives the
  // endpoint from server.resolvedUrls (which includes Vite's base). When
  // base !== '/', the client calls /<base>/__vite_rsc_load_module_dev_proxy
  // and 404s. Prepend a rewrite so those calls reach the real handler.
  const rpcSuffix = '__vite_rsc_load_module_dev_proxy'
  const rewriteStack = server.middlewares.stack as Array<{
    route: string
    handle: (req: IncomingMessageLike, res: unknown, next: (err?: unknown) => void) => void
  }>
  rewriteStack.unshift({
    route: '',
    handle(req, _res, next) {
      const base = getBase()
      if (base !== '/' && req.url?.startsWith(base + rpcSuffix)) {
        req.url = '/' + req.url.slice(base.length)
      }
      next()
    },
  })

  server.middlewares.use(async (req, res, next) => {
    if (req.method !== 'GET') return next()
    const host = req.headers.host ?? 'localhost'
    const url = new URL(req.url ?? '/', `http://${host}`)

    const base = getBase()
    const basePath = stripBase(url.pathname, base)
    const pages = getPages()
    const match = pages.find(
      (p) => p.pathname === basePath || p.pathname === basePath + '/'
    )
    if (!match) return next()

    const rscEnv = server.environments.rsc
    if (!rscEnv || !isRunnableDevEnvironment(rscEnv)) return next()

    try {
      const mod = (await rscEnv.runner.import(RSC_ENTRY_ID)) as RscEntry
      const result = await mod.handleRequest(
        new Request(new URL(url.pathname, `http://${host}`), { method: 'GET' })
      )
      if (!result) return next()
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      Readable.fromWeb(
        result.html as Parameters<typeof Readable.fromWeb>[0]
      ).pipe(res)
    } catch (err) {
      server.ssrFixStacktrace(err as Error)
      next(err)
    }
  })
}

function stripBase(pathname: string, base: string): string {
  if (base === '/' || !pathname.startsWith(base)) return pathname
  return '/' + pathname.slice(base.length)
}
