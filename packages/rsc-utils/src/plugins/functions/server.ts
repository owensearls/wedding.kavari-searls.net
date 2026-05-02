import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'
import { endpoint } from 'virtual:rsc-utils/functions/config'
import { modules } from 'virtual:rsc-utils/functions/modules'

export type RscHandler = {
  handle: (request: Request) => Promise<Response | null>
}

// Throw from a server action to surface a controlled status + message to the
// caller. Any other thrown value is treated as unexpected: the full error is
// logged server-side and the client receives a sanitized fallback with 500.
export class RscActionError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'RscActionError'
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

export function createRscHandlers(): RscHandler {
  const allowedIds = collectActionIds(modules)

  return {
    async handle(request) {
      const url = new URL(request.url)
      if (!url.pathname.startsWith(endpoint)) return null

      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
      }

      const actionId = decodeURIComponent(url.pathname.slice(endpoint.length))
      if (!allowedIds.has(actionId)) {
        return new Response('Forbidden', { status: 403 })
      }

      let status = 200
      let result: unknown
      try {
        const contentType = request.headers.get('content-type') ?? ''
        const body = contentType.includes('multipart/form-data')
          ? await request.formData()
          : await request.text()
        const args = await decodeReply(body)
        const fn = await loadServerAction(actionId)
        result = await fn(...args)
      } catch (err) {
        console.error('[rsc-utils] server action failed', {
          actionId,
          error: serializeError(err),
        })
        if (err instanceof RscActionError) {
          status = err.status
          result = rejectedPromise(err.message)
        } else {
          status = 500
          result = rejectedPromise(FALLBACK_MESSAGE)
        }
      }

      const stream = renderToReadableStream(result)
      return new Response(stream, {
        status,
        headers: { 'content-type': 'text/x-component' },
      })
    },
  }
}

// Wrap the rejection in an async IIFE so the unhandled-rejection moment is
// owned by a function the RSC stream is about to consume.
async function rejectedPromise(message: string): Promise<never> {
  throw new Error(message)
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { value: err }
}

function collectActionIds(
  mods: Record<string, Record<string, unknown>>
): Set<string> {
  const ids = new Set<string>()
  for (const mod of Object.values(mods)) {
    for (const value of Object.values(mod)) {
      if (typeof value !== 'function') continue
      const $$id = (value as { $$id?: unknown }).$$id
      if (typeof $$id === 'string') ids.add($$id)
    }
  }
  return ids
}
