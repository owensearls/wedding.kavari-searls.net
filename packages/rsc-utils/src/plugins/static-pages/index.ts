import path from 'node:path'
import type { Plugin } from 'vite'
import { renderStatic } from './build-orchestrator.js'
import { installDevMiddleware } from './dev-middleware.js'
import { discoverPages, type PageEntry } from './page-discovery.js'
import {
  RSC_ENTRY_ID,
  SSR_ENTRY_ID,
  virtualModulesPlugin,
} from './virtual-modules.js'

export type RscStaticPagesOptions = {
  basename?: string
  pages: Record<string, string>
}

export function rscStaticPages(options: RscStaticPagesOptions): Plugin[] {
  if (!options.pages || Object.keys(options.pages).length === 0) {
    throw new Error(
      `[rsc-utils:static-pages] 'pages' must contain at least one entry`
    )
  }

  let cache: PageEntry[] | null = null
  let projectRoot = process.cwd()

  const getPages = (): PageEntry[] => {
    if (!cache) {
      cache = discoverPages({
        projectRoot,
        basename: options.basename ?? '/',
        pages: options.pages,
      })
    }
    return cache
  }

  const invalidatePages = () => {
    cache = null
  }

  return [
    {
      name: 'rsc-utils:static-pages',
      config: {
        order: 'pre',
        handler(userConfig, env) {
          projectRoot = path.resolve(userConfig.root ?? process.cwd())
          invalidatePages()
          return {
            appType: env.isPreview ? 'mpa' : undefined,
            environments: {
              rsc: {
                build: {
                  rollupOptions: {
                    input: { index: RSC_ENTRY_ID },
                  },
                },
              },
              ssr: {
                build: {
                  rollupOptions: {
                    input: { index: SSR_ENTRY_ID },
                  },
                },
              },
            },
            rsc: {
              serverHandler: env.isPreview ? false : undefined,
            },
          }
        },
      },
      configureServer(server) {
        installDevMiddleware(server, getPages)
      },
      handleHotUpdate(ctx) {
        const absPaths = new Set(getPages().map((p) => p.absPath))
        if (absPaths.has(ctx.file)) invalidatePages()
      },
      buildApp: {
        order: 'post',
        async handler(builder) {
          await renderStatic(builder.config)
        },
      },
    },
    virtualModulesPlugin({ getPages }),
  ]
}
