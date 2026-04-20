import {
  getStaticPaths,
  handleRequest,
} from 'virtual:rsc-utils/static-pages/rsc-entry'

export { getStaticPaths, handleRequest }

type AssetFetcher = { fetch: (request: Request) => Promise<Response> }

export async function serveStaticPage(
  request: Request,
  assets: AssetFetcher
): Promise<Response> {
  const assetResponse = await assets.fetch(request)
  if (assetResponse.status !== 404) return assetResponse

  // In dev, Cloudflare's vite plugin routes env.ASSETS.fetch back through
  // Vite middleware rather than serving wrangler's [assets].directory,
  // so prerendered HTML isn't reachable — render the page live. In prod
  // ASSETS already has the HTML, so this branch is never taken.
  const result = await handleRequest(request)
  if (!result) return assetResponse

  return new Response(result.html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
