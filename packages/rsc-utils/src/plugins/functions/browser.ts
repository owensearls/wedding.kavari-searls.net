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
      // Action errors ride the RSC stream with a non-2xx status — let the
      // client decoder surface the rejection through the awaited call.
      if (ct.includes('text/x-component')) return res
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(
          `Server action ${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
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
