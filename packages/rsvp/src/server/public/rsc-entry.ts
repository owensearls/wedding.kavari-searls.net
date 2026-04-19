import {
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from '@vitejs/plugin-rsc/rsc'

const PREFIX = '/@rsc-public/'

const modules = import.meta.glob<Record<string, unknown>>('./*.ts', {
  eager: true,
})

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

const allowedIds = collectActionIds(modules)

export async function handlePublicRsc(
  request: Request
): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response('Not found', { status: 404 })
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const actionId = decodeURIComponent(url.pathname.slice(PREFIX.length))
  if (!allowedIds.has(actionId)) {
    return new Response('Forbidden', { status: 403 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  const body = contentType.includes('multipart/form-data')
    ? await request.formData()
    : await request.text()

  const args = await decodeReply(body)
  const fn = await loadServerAction(actionId)
  const result = await fn(...args)

  const stream = renderToReadableStream(result)
  return new Response(stream, {
    headers: { 'content-type': 'text/x-component' },
  })
}

export { allowedIds as publicActionIds }
