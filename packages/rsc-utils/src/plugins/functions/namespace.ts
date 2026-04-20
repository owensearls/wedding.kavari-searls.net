import { endpoints } from 'virtual:rsc-utils/functions/config'
import { setupServerCallback } from './browser.js'

// Wires up the server-callback for a same-origin RSC namespace. The URL
// prefix is derived from the rscFunctions plugin's resolved config
// (Vite's config.base by default, or the namespace's basename override).
// For cross-origin consumers, call setupServerCallback directly with an
// explicit URL instead.
export function setupNamespaceCallback(name: string): void {
  const endpoint = endpoints[name]
  if (!endpoint) {
    throw new Error(
      `[rsc-utils:functions] unknown namespace '${name}' — is it declared in rscFunctions config?`
    )
  }
  setupServerCallback(endpoint)
}
