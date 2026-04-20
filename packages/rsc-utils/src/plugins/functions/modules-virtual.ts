import type { Plugin } from 'vite'
import type { FunctionsConfig } from '../../types'

const VIRTUAL_ID = 'virtual:rsc-utils/functions/modules'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export function modulesVirtualPlugin(config: FunctionsConfig): Plugin {
  return {
    name: 'rsc-utils:functions-modules',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const entries = config.namespaces.map((ns) => {
        const glob = normalizeGlob(ns.glob)
        return `  ${JSON.stringify(ns.name)}: import.meta.glob(${JSON.stringify(glob)}, { eager: true })`
      })
      return `export const modules = {\n${entries.join(',\n')}\n}\n`
    },
  }
}

function normalizeGlob(glob: string): string {
  return glob.startsWith('/') ? glob : `/${glob}`
}
