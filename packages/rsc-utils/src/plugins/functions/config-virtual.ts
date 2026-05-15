import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:rsc-utils/functions/config'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function configVirtualPlugin(): Plugin {
  let viteBase = '/'

  return {
    name: 'rsc-utils:functions-config',
    configResolved(resolved) {
      viteBase = resolved.base
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const base = normalizeBase(viteBase)
      const endpoint = `${base}@rsc/`
      return `export const endpoint = ${JSON.stringify(endpoint)}\n`
    },
  }
}

function normalizeBase(base: string): string {
  const trimmed = base.endsWith('/') ? base : `${base}/`
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
