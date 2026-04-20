import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'
import { modules as namespaceModules } from 'virtual:rsc-utils/functions/modules'
import type { CorsOptions, FunctionsConfig, NamespaceConfig } from '../../types'

type Handler = (request: Request) => Promise<Response>

export type RscHandlers = {
  handle: (request: Request) => Promise<Response | null>
  handlers: Record<string, Handler>
}

export function createRscHandlers(config: FunctionsConfig): RscHandlers {
  const handlers: Record<string, Handler> = {}
  const routes: Array<{ prefix: string; handler: Handler }> = []

  for (const ns of config.namespaces) {
    const prefix = `/@rsc-${ns.name}/`
    const modules = namespaceModules[ns.name] ?? {}
    const handler = buildHandler({ prefix, modules, cors: ns.cors })
    handlers[ns.name] = handler
    routes.push({ prefix, handler })
  }

  return {
    handlers,
    async handle(request) {
      const url = new URL(request.url)
      for (const route of routes) {
        if (url.pathname.startsWith(route.prefix)) {
          return route.handler(request)
        }
      }
      return null
    },
  }
}

function buildHandler(opts: {
  prefix: string
  modules: Record<string, Record<string, unknown>>
  cors?: CorsOptions
}): Handler {
  const allowedIds = collectActionIds(opts.modules)
  const corsHeaders = opts.cors ? buildCorsHeaders(opts.cors) : null

  return async (request) => {
    const url = new URL(request.url)

    if (corsHeaders && request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (!url.pathname.startsWith(opts.prefix)) {
      return respond(new Response('Not found', { status: 404 }), corsHeaders)
    }
    if (request.method !== 'POST') {
      return respond(
        new Response('Method not allowed', { status: 405 }),
        corsHeaders
      )
    }

    const actionId = decodeURIComponent(url.pathname.slice(opts.prefix.length))
    if (!allowedIds.has(actionId)) {
      return respond(new Response('Forbidden', { status: 403 }), corsHeaders)
    }

    const contentType = request.headers.get('content-type') ?? ''
    const body = contentType.includes('multipart/form-data')
      ? await request.formData()
      : await request.text()

    const args = await decodeReply(body)
    const fn = await loadServerAction(actionId)
    const result = await fn(...args)
    const stream = renderToReadableStream(result)

    return respond(
      new Response(stream, {
        headers: { 'content-type': 'text/x-component' },
      }),
      corsHeaders
    )
  }
}

function collectActionIds(
  modules: Record<string, Record<string, unknown>>
): Set<string> {
  const ids = new Set<string>()
  for (const mod of Object.values(modules)) {
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}

function buildCorsHeaders(cors: CorsOptions): Record<string, string> {
  const origin = Array.isArray(cors.origin) ? cors.origin.join(', ') : cors.origin
  const methods = cors.methods ?? ['POST', 'OPTIONS']
  const headers = cors.headers ?? ['content-type', 'rsc-action-id']
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': methods.join(', '),
    'access-control-allow-headers': headers.join(', '),
  }
}

function respond(
  response: Response,
  corsHeaders: Record<string, string> | null
): Response {
  if (!corsHeaders) return response
  const merged = new Response(response.body, response)
  for (const [k, v] of Object.entries(corsHeaders)) {
    merged.headers.set(k, v)
  }
  return merged
}

export type { FunctionsConfig, NamespaceConfig, CorsOptions }
