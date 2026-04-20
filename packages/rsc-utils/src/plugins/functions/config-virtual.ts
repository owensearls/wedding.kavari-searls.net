import type { Plugin } from 'vite'
import type { FunctionsConfig } from '../../types.js'

const VIRTUAL_ID = 'virtual:rsc-utils/functions/config'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function configVirtualPlugin(config: FunctionsConfig): Plugin {
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
      const endpoints: Record<string, string> = {}
      for (const ns of config.namespaces) {
        const base = normalizeBase(ns.basename ?? viteBase)
        endpoints[ns.name] = `${base}@rsc-${ns.name}/`
      }
      return `export const endpoints = ${JSON.stringify(endpoints)}\n`
    },
  }
}

function normalizeBase(base: string): string {
  const trimmed = base.endsWith('/') ? base : `${base}/`
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
