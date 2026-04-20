import { createFromReadableStream } from '@vitejs/plugin-rsc/ssr'
import React from 'react'
import { prerender } from 'react-dom/static.edge'
import { injectRSCPayload } from 'rsc-html-stream/server'

type RscPayload = { root: React.ReactNode }

export async function renderHtml(
  rscStream: ReadableStream<Uint8Array>
): Promise<{ stream: ReadableStream<Uint8Array> }> {
  const [rscStream1, rscStream2] = rscStream.tee()
  let payload: Promise<RscPayload>
  function SsrRoot() {
    payload ??= createFromReadableStream<RscPayload>(rscStream1)
    const root = React.use(payload).root
    return root
  }
  const bootstrapScriptContent =
    await import.meta.viteRsc.loadBootstrapScriptContent('index')

  const prerenderResult = await prerender(<SsrRoot />, {
    bootstrapScriptContent,
  })
  const htmlStream = prerenderResult.prelude
  const responseStream = htmlStream.pipeThrough(injectRSCPayload(rscStream2))
  return { stream: responseStream }
}
