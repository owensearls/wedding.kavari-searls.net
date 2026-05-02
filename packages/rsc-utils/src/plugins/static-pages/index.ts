import path from 'node:path'
import { renderStatic } from './build-orchestrator.js'
import { installDevMiddleware } from './dev-middleware.js'
import { discoverPages, type PageEntry } from './page-discovery.js'
import {
  RSC_ENTRY_ID,
  SSR_ENTRY_ID,
  virtualModulesPlugin,
} from './virtual-modules.js'
import type { Plugin } from 'vite'

export type RscStaticPagesOptions = {
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
  let base = '/'

  const getPages = (): PageEntry[] => {
    if (!cache) {
      cache = discoverPages({ projectRoot, pages: options.pages })
    }
    return cache
  }

  const invalidatePages = () => {
    cache = null
  }

  const getBase = () => base

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
      configResolved(config) {
        base = config.base
      },
      configureServer(server) {
        installDevMiddleware(server, getPages, getBase)
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
    virtualModulesPlugin({ getPages, getBase }),
    rewriteWranglerAssetsDir(),
  ]
}

// @cloudflare/vite-plugin force-sets assets.directory to the client outDir, double-prefixing Vite's base on disk lookups. Strip the trailing base segment so the binding's URL-root sits one level up. See workers-sdk#9885.
function rewriteWranglerAssetsDir(): Plugin {
  return {
    name: 'rsc-utils:static-pages:rewrite-wrangler-assets-dir',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const base = this.environment.config.base
      if (!base || base === '/') return
      const file = bundle['wrangler.json']
      if (!file || file.type !== 'asset') return
      const source =
        typeof file.source === 'string'
          ? file.source
          : Buffer.from(file.source).toString('utf-8')
      const config = JSON.parse(source)
      if (typeof config.assets?.directory !== 'string') return
      const suffix = base.replace(/^\/|\/$/g, '')
      const stripped = config.assets.directory.replace(
        new RegExp(`/${suffix}$`),
        ''
      )
      config.assets.directory = stripped || '.'
      file.source = JSON.stringify(config)
    },
  }
}
