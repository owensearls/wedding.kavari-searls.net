import { renderToReadableStream } from '@vitejs/plugin-rsc/rsc'
import { Root } from '../root'

export { getStaticPaths } from '../root'

export async function handleSsg(request: Request): Promise<{
  html: ReadableStream<Uint8Array>
  rsc: ReadableStream<Uint8Array>
}> {
  const url = new URL(request.url)
  const rscPayload = { root: <Root url={url} /> }
  const rscStream = renderToReadableStream(rscPayload)
  const [rscStream1, rscStream2] = rscStream.tee()
  const ssr = await import.meta.viteRsc.loadModule<
    typeof import('../entry.ssr')
  >('ssr', 'index')
  const ssrResult = await ssr.renderHtml(rscStream1, { ssg: true })
  return { html: ssrResult.stream, rsc: rscStream2 }
}
