import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser'

// Single-endpoint RPC. The server authorizes admin vs public by looking up
// the action id in module-derived allowlists, so the client does not need to
// encode that distinction in the URL. This also avoids depending on the id
// format, which is path-based in dev but opaque-hashed in production builds.
export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
    // Validate the response shape before handing it to createFromFetch.
    // Without this, any non-Flight body (e.g. a 401 "Unauthorized" plaintext)
    // fails deep inside the Flight parser as a generic "Connection closed.",
    // which hides the real status and makes auth/network errors un-debuggable.
    const response = fetch(`/@rsc/${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'rsc-action-id': id },
      body,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Server action ${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
        )
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('text/x-component')) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Server action ${id} returned unexpected content-type "${ct || '<missing>'}": ${text.slice(0, 200)}`
        )
      }
      return res
    })
    return createFromFetch(response)
  })
}
