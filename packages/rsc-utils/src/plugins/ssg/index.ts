import type { Plugin } from 'vite'
import { renderStatic } from './build-orchestrator.js'

const SSG_ENTRY_ID = 'virtual:rsc-utils/ssg-entry'
const RESOLVED_SSG_ID = '\0' + SSG_ENTRY_ID

export type RscSsgOptions = {
  staticPaths: string[]
}

export function rscSsg(options: RscSsgOptions): Plugin[] {
  return [virtualEntriesPlugin(options), orchestratorPlugin()]
}

function virtualEntriesPlugin(options: RscSsgOptions): Plugin {
  return {
    name: 'rsc-utils:ssg-virtual',
    enforce: 'pre',
    resolveId(id) {
      if (id === SSG_ENTRY_ID) return RESOLVED_SSG_ID
    },
    load(id) {
      if (id === RESOLVED_SSG_ID) {
        return [
          `const STATIC_PATHS = ${JSON.stringify(options.staticPaths)}`,
          `export function getStaticPaths() { return STATIC_PATHS }`,
          '',
        ].join('\n')
      }
    },
  }
}

function orchestratorPlugin(): Plugin {
  return {
    name: 'rsc-utils:ssg',
    config: {
      order: 'pre',
      handler(_config, env) {
        return {
          appType: env.isPreview ? 'mpa' : undefined,
          rsc: {
            serverHandler: env.isPreview ? false : undefined,
          },
        }
      },
    },
    buildApp: {
      async handler(builder) {
        await renderStatic(builder.config)
      },
    },
  }
}
