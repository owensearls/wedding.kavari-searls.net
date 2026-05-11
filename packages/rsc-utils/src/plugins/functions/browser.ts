import {
  createFromFetch,
  encodeReply,
  setServerCallback,
} from '@vitejs/plugin-rsc/browser'
import { endpoint } from 'virtual:rsc-utils/functions/config'

export function setupServerCallback(): void {
  setServerCallback(async (id, args) => {
    const body = await encodeReply(args)
    const response = fetch(`${endpoint}${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'rsc-action-id': id },
      body,
    }).then(async (res) => {
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.includes('text/x-component')) return res
      // Server emits errors as plain text (with the appropriate status) so
      // React's production RSC encoder doesn't strip the message. Surface the
      // body verbatim to the caller.
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          text || res.statusText || `Request failed (${res.status})`
        )
      }
      const text = await res.text().catch(() => '')
      throw new Error(
        `Server action ${id} returned unexpected content-type "${ct || '<missing>'}": ${text.slice(0, 200)}`
      )
    })
    return createFromFetch(response)
  })
}
