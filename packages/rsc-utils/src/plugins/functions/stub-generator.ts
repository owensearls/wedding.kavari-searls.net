import fs from 'node:fs'
import path from 'node:path'
import { getPluginApi } from '@vitejs/plugin-rsc'
import type { Plugin, ResolvedConfig } from 'vite'
import type { FunctionsConfig, NamespaceConfig } from '../../types.js'

interface ServerReferenceMeta {
  importId: string
  referenceKey: string
  exportNames: string[]
}

export function stubGeneratorPlugin(config: FunctionsConfig): Plugin {
  const stubNamespaces = config.namespaces.filter((ns) => ns.buildStub)
  let manager: { serverReferenceMetaMap: Record<string, ServerReferenceMeta> }
  let outDir: string

  return {
    name: 'rsc-utils:functions-stubs',
    apply: 'build',
    enforce: 'post',

    configResolved(resolved: ResolvedConfig) {
      const api = getPluginApi(resolved)
      if (!api) {
        throw new Error(
          'rsc-utils:functions-stubs: @vitejs/plugin-rsc not found — is it registered?'
        )
      }
      manager = api.manager
      outDir = path.resolve(resolved.build.outDir)
    },

    closeBundle: {
      order: 'post' as const,
      async handler() {
        if (stubNamespaces.length === 0) return

        const allMetas = Object.values(manager.serverReferenceMetaMap)
        const pkgRoot = path.resolve(outDir, '..')
        const apiDir = path.join(pkgRoot, 'dist', 'client-api')
        await fs.promises.mkdir(apiDir, { recursive: true })

        for (const ns of stubNamespaces) {
          const matches = allMetas.filter((meta) =>
            matchesGlob(meta.importId, ns)
          )
          if (matches.length === 0) {
            console.warn(
              `[rsc-utils:functions-stubs] no server references matched glob for namespace '${ns.name}' (${ns.glob})`
            )
            continue
          }
          await writeStub(apiDir, ns.name, matches)
        }
      },
    },
  }
}

function matchesGlob(importId: string, ns: NamespaceConfig): boolean {
  const pattern = globToRegex(ns.glob)
  return pattern.test(importId)
}

function globToRegex(glob: string): RegExp {
  const trimmed = glob.replace(/^\//, '')
  const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const body = escaped
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`(?:^|/)${body}$`)
}

async function writeStub(
  apiDir: string,
  name: string,
  metas: ServerReferenceMeta[]
): Promise<void> {
  const lines: string[] = [
    "import { createServerReference, callServer } from '@vitejs/plugin-rsc/browser'",
    '',
  ]

  for (const meta of metas) {
    for (const exportName of meta.exportNames) {
      const fullId = `${meta.referenceKey}#${exportName}`
      const safeName = exportName === 'default' ? '_default' : exportName
      lines.push(
        `export const ${safeName} = /* @__PURE__ */ createServerReference(${JSON.stringify(fullId)}, callServer, undefined, undefined, ${JSON.stringify(exportName)})`
      )
    }
  }
  lines.push('')

  const outPath = path.join(apiDir, `${name}.js`)
  await fs.promises.writeFile(outPath, lines.join('\n'))

  const count = metas.reduce((n, m) => n + m.exportNames.length, 0)
  console.log(
    `[rsc-utils:functions-stubs] wrote ${count} stubs for namespace '${name}' → dist/client-api/${name}.js`
  )
}
