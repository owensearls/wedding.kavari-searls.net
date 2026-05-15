import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:rsc-utils/functions/modules'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

export function modulesVirtualPlugin(include: string[]): Plugin {
  return {
    name: 'rsc-utils:functions-modules',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const globs = include.map(normalizeGlob)
      return `export const modules = import.meta.glob(${JSON.stringify(globs)}, { eager: true })\n`
    },
  }
}

function normalizeGlob(glob: string): string {
  return glob.startsWith('/') ? glob : `/${glob}`
}
