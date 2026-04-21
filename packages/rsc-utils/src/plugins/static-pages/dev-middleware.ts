import { Readable } from 'node:stream'
import type { DevEnvironment, ViteDevServer } from 'vite'
import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner'
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

type InvokePayload = {
  type: 'custom'
  event: 'vite:invoke'
  data: { name: string; id: string; data: unknown[] }
}

export function installDevMiddleware(
  server: ViteDevServer,
  getPages: () => PageEntry[],
  getBase: () => string
): void {
  // Plugin-rsc's loadModuleDevProxy RPC client derives its endpoint from
  // server.resolvedUrls (which includes Vite's base), but plugin-rsc
  // registers the handler at the base-less path. Rewrite so those RPC
  // calls reach the real handler when base !== '/'.
  const rpcSuffix = '__vite_rsc_load_module_dev_proxy'
  const rewriteStack = server.middlewares.stack as Array<{
    route: string
    handle: (
      req: IncomingMessageLike,
      res: unknown,
      next: (err?: unknown) => void
    ) => void
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

  // Secondary Node-side module runner against the rsc environment's transform
  // pipeline. Bypasses `createServerModuleRunner` because Cloudflare's custom
  // hot channel is incompatible with Vite's default runner transport. Our
  // transport handles the two `invoke` names ModuleRunner actually needs
  // (`fetchModule`, `getBuiltins`) by delegating straight to the environment.
  const rscEnv = server.environments.rsc
  const runner = new ModuleRunner(
    {
      transport: {
        async invoke(payload) {
          const { name, data: args } = (payload as InvokePayload).data
          try {
            if (name === 'fetchModule') {
              const [id, importer, options] = args as [
                string,
                string | undefined,
                Parameters<DevEnvironment['fetchModule']>[2],
              ]
              return { result: await rscEnv.fetchModule(id, importer, options) }
            }
            if (name === 'getBuiltins') {
              return {
                result: rscEnv.config.resolve.builtins.map((b) =>
                  typeof b === 'string'
                    ? { type: 'string' as const, value: b }
                    : {
                        type: 'RegExp' as const,
                        source: b.source,
                        flags: b.flags,
                      }
                ),
              }
            }
            throw new Error(`unsupported invoke: ${name}`)
          } catch (error) {
            const e = error as Error
            return {
              error: { name: e.name, message: e.message, stack: e.stack },
            }
          }
        },
      },
      hmr: false,
      sourcemapInterceptor: false,
    },
    new ESModulesEvaluator()
  )

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

    try {
      const mod = (await runner.import(RSC_ENTRY_ID)) as RscEntry
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
