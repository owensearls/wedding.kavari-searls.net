import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import type { ResolvedConfig } from 'vite'

const RSC_POSTFIX = '_.rsc'

type RscEntry = {
  getStaticPaths: () => string[] | Promise<string[]>
  handleSsg: (request: Request) => Promise<{
    html: ReadableStream<Uint8Array>
    rsc: ReadableStream<Uint8Array>
  }>
}

export async function renderStatic(config: ResolvedConfig): Promise<void> {
  const entryPath = path.join(config.environments.rsc.build.outDir, 'index.js')
  const entry: RscEntry = await import(pathToFileURL(entryPath).href)
  const staticPaths = await entry.getStaticPaths()
  const baseDir = config.environments.client.build.outDir

  for (const staticPath of staticPaths) {
    config.logger.info(`[rsc-utils:ssg] -> ${staticPath}`)
    const { html, rsc } = await entry.handleSsg(
      new Request(new URL(staticPath, 'http://ssg.local'))
    )
    await writeFileStream(
      path.join(baseDir, normalizeHtmlFilePath(staticPath)),
      html
    )
    await writeFileStream(
      path.join(baseDir, `${staticPath}${RSC_POSTFIX}`),
      rsc
    )
  }
}

async function writeFileStream(
  filePath: string,
  stream: ReadableStream
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(
    filePath,
    Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0])
  )
}

function normalizeHtmlFilePath(p: string): string {
  if (p.endsWith('/')) {
    return `${p}index.html`
  }
  return `${p}.html`
}
