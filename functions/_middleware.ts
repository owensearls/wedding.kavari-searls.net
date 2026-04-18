// Pages Functions middleware.
// 1. Serves the admin SPA for any /admin/* path that isn't a static asset.
// 2. Catches uncaught errors in /api handlers so the client always gets JSON.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)

  if (url.pathname.startsWith('/api/')) {
    try {
      return await context.next()
    } catch (err) {
      console.error('Unhandled API error', err)
      return Response.json(
        {
          error: 'Internal server error',
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 500 },
      )
    }
  }

  // Admin SPA fallback — for any /admin path that isn't a static asset file,
  // fetch admin/index.html from the asset store and return it directly.
  if (
    url.pathname.startsWith('/admin') &&
    !url.pathname.match(/\.\w+$/)
  ) {
    try {
      const assetUrl = new URL('/admin/index.html', url.origin)
      const res = await context.env.ASSETS.fetch(assetUrl.toString())
      // ASSETS.fetch may return a redirect for directory paths; follow it.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (location) {
          return context.env.ASSETS.fetch(new URL(location, url.origin).toString())
        }
      }
      return new Response(res.body, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    } catch {
      // Fall through to default behavior if ASSETS isn't available.
    }
  }

  return context.next()
}
