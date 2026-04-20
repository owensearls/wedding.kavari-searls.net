import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import type React from 'react'

type SsgResult = {
  html: ReadableStream<Uint8Array>
  rsc: ReadableStream<Uint8Array>
}

type SsrModule = {
  renderHtml: (
    rscStream: ReadableStream<Uint8Array>
  ) => Promise<{ stream: ReadableStream<Uint8Array> }>
}

export function createSsgHandler(opts: {
  Root: React.ComponentType<{ url: URL }>
}): {
  handleSsg: (request: Request) => Promise<SsgResult>
} {
  const { Root } = opts

  return {
    async handleSsg(request) {
      const url = new URL(request.url)
      const rscPayload = { root: <Root url={url} /> }
      const rscStream = renderToReadableStream(rscPayload)
      const [rscStream1, rscStream2] = rscStream.tee()
      const ssr = await import.meta.viteRsc.loadModule<SsrModule>(
        'ssr',
        'index'
      )
      const ssrResult = await ssr.renderHtml(rscStream1)
      return { html: ssrResult.stream, rsc: rscStream2 }
    },
  }
}
