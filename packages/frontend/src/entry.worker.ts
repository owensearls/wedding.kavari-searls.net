import { getStaticPaths, handleRequest } from 'rsc-utils/static-pages/server'

export { getStaticPaths, handleRequest }

export interface Env {
  ASSETS: Fetcher
}

export default {
  async fetch(request: Request): Promise<Response> {
    const rendered = await handleRequest(request)
    // Old links (e.g. /rsvp invite URLs) land on the home page.
    if (!rendered) return Response.redirect(new URL('/', request.url).href, 302)
    return new Response(rendered.html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  },
} satisfies ExportedHandler<Env>
