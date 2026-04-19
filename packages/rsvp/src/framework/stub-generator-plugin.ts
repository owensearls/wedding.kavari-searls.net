import fs from 'node:fs'
import path from 'node:path'
import { getPluginApi } from '@vitejs/plugin-rsc'
import type { Plugin, ResolvedConfig } from 'vite'

interface ServerReferenceMeta {
  importId: string
  referenceKey: string
  exportNames: string[]
}

export function stubGeneratorPlugin(): Plugin {
  let manager: { serverReferenceMetaMap: Record<string, ServerReferenceMeta> }
  let outDir: string

  return {
    name: 'rsvp-stub-generator',
    apply: 'build',
    enforce: 'post',

    configResolved(config: ResolvedConfig) {
      const api = getPluginApi(config)
      if (!api) {
        throw new Error(
          'rsvp-stub-generator: @vitejs/plugin-rsc not found — is it registered?'
        )
      }
      manager = api.manager
      outDir = path.resolve(config.build.outDir)
    },

    closeBundle: {
      order: 'post' as const,
      async handler() {
        const publicEntries = Object.values(
          manager.serverReferenceMetaMap
        ).filter((meta) => meta.importId.includes('/server/public/'))

        if (publicEntries.length === 0) {
          console.warn(
            '[rsvp-stub-generator] No public server references found'
          )
          return
        }

        const lines: string[] = [
          "import { createServerReference, callServer } from '@vitejs/plugin-rsc/browser'",
          '',
        ]

        for (const meta of publicEntries) {
          for (const name of meta.exportNames) {
            const fullId = `${meta.referenceKey}#${name}`
            const safeName = name === 'default' ? '_default' : name
            lines.push(
              `export const ${safeName} = /* @__PURE__ */ createServerReference(${JSON.stringify(fullId)}, callServer, undefined, undefined, ${JSON.stringify(name)})`
            )
          }
        }

        lines.push('')

        const pkgRoot = path.resolve(outDir, '..')
        const apiDir = path.join(pkgRoot, 'dist', 'client-api')
        await fs.promises.mkdir(apiDir, { recursive: true })
        await fs.promises.writeFile(
          path.join(apiDir, 'public.js'),
          lines.join('\n')
        )

        console.log(
          `[rsvp-stub-generator] Generated ${publicEntries.reduce((n, m) => n + m.exportNames.length, 0)} stubs → dist/client-api/public.js`
        )
      },
    },
  }
}
