import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import type { Plugin, ResolvedConfig } from 'vite'

const RSC_POSTFIX = '_.rsc'

export function rscSsgPlugin(): Plugin[] {
  return [
    {
      name: 'rsc-ssg',
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
    },
  ]
}

type RscEntry = {
  getStaticPaths: () => Promise<string[]>
  handleSsg: (request: Request) => Promise<{
    html: ReadableStream<Uint8Array>
    rsc: ReadableStream<Uint8Array>
  }>
}

async function renderStatic(config: ResolvedConfig) {
  const entryPath = path.join(
    config.environments.rsc.build.outDir,
    'index.js'
  )
  const entry: RscEntry = await import(pathToFileURL(entryPath).href)
  const staticPaths = await entry.getStaticPaths()
  const baseDir = config.environments.client.build.outDir
  for (const staticPatch of staticPaths) {
    config.logger.info(`[vite-rsc:ssg] -> ${staticPatch}`)
    const { html, rsc } = await entry.handleSsg(
      new Request(new URL(staticPatch, 'http://ssg.local'))
    )
    await writeFileStream(
      path.join(baseDir, normalizeHtmlFilePath(staticPatch)),
      html
    )
    await writeFileStream(
      path.join(baseDir, `${staticPatch}${RSC_POSTFIX}`),
      rsc
    )
  }
}

async function writeFileStream(filePath: string, stream: ReadableStream) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(
    filePath,
    Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0])
  )
}

function normalizeHtmlFilePath(p: string) {
  if (p.endsWith('/')) {
    return `${p}index.html`
  }
  return `${p}.html`
}
