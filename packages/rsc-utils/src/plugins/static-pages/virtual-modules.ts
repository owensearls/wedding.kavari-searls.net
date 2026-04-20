import type { Plugin } from 'vite'
import type { PageEntry } from './page-discovery.js'

export const RSC_ENTRY_ID = 'virtual:rsc-utils/static-pages/rsc-entry'
export const SSR_ENTRY_ID = 'virtual:rsc-utils/static-pages/ssr-entry'
export const MANIFEST_ID = 'virtual:rsc-utils/static-pages/manifest'

const RESOLVED_PREFIX = '\0'

export type VirtualCtx = {
  getPages: () => PageEntry[]
  getBase: () => string
}

export function virtualModulesPlugin(ctx: VirtualCtx): Plugin {
  const ids = new Set([RSC_ENTRY_ID, SSR_ENTRY_ID, MANIFEST_ID])

  return {
    name: 'rsc-utils:static-pages-virtual',
    enforce: 'pre',
    resolveId(id) {
      if (ids.has(id)) return RESOLVED_PREFIX + id
    },
    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return
      const unresolved = id.slice(RESOLVED_PREFIX.length)
      switch (unresolved) {
        case MANIFEST_ID:
          return generateManifest(ctx.getPages())
        case RSC_ENTRY_ID:
          return generateRscEntry(ctx.getBase())
        case SSR_ENTRY_ID:
          return generateSsrEntry()
        default:
          return
      }
    },
  }
}

function generateManifest(pages: PageEntry[]): string {
  const imports = pages
    .map((p, i) => `import Page${i} from ${JSON.stringify(p.absPath)}`)
    .join('\n')
  const list = pages
    .map(
      (p, i) =>
        `  { pathname: ${JSON.stringify(p.pathname)}, entryName: ${JSON.stringify(p.entryName)}, Component: Page${i} }`
    )
    .join(',\n')
  return `${imports}\n\nexport const pages = [\n${list}\n]\n`
}

function generateRscEntry(base: string): string {
  return `\
import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { createElement } from 'react'
import { pages } from ${JSON.stringify(MANIFEST_ID)}

const BASE = ${JSON.stringify(base)}
const byPath = new Map(pages.map((p) => [p.pathname, p]))

function stripBase(pathname) {
  if (BASE === '/' || !pathname.startsWith(BASE)) return pathname
  return '/' + pathname.slice(BASE.length)
}

export function getStaticPaths() {
  return pages.map((p) => p.pathname)
}

export async function handleRequest(request) {
  const url = new URL(request.url)
  const page = byPath.get(stripBase(url.pathname))
  if (!page) return null

  const rscStream = renderToReadableStream({
    root: createElement(page.Component, { url }),
  })
  const [s1, s2] = rscStream.tee()
  const ssr = await import.meta.viteRsc.loadModule('ssr', 'index')
  const { stream } = await ssr.renderHtml(s1)
  return { html: stream, rsc: s2 }
}
`
}

function generateSsrEntry(): string {
  return `\
import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import React from 'react'
import { prerender } from 'react-dom/static.edge'
import { injectRSCPayload } from 'rsc-html-stream/server'

export async function renderHtml(rscStream) {
  const [rscStream1, rscStream2] = rscStream.tee()
  let payload
  function SsrRoot() {
    payload ??= createFromReadableStream(rscStream1)
    const root = React.use(payload).root
    return root
  }
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent('index')

  const prerenderResult = await prerender(React.createElement(SsrRoot), {
    bootstrapScriptContent,
  })
  const htmlStream = prerenderResult.prelude
  const responseStream = htmlStream.pipeThrough(injectRSCPayload(rscStream2))
  return { stream: responseStream }
}
`
}
