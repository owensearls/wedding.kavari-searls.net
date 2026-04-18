// Pages Functions middleware.
// 1. Serves the admin SPA for any /admin/* path that isn't a static asset.
// 2. Catches uncaught errors in /api handlers so the client always gets JSON.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)

  // Admin SPA fallback — serve admin/index.html for any /admin/* path that
  // doesn't resolve to a static asset (JS/CSS/etc). This mirrors the
  // _redirects rule which wrangler pages dev doesn't always process.
  if (
    url.pathname.startsWith('/admin') &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.match(/\.\w+$/)
  ) {
    const assetUrl = new URL('/admin/index.html', url.origin)
    return context.env.ASSETS.fetch(new Request(assetUrl, context.request))
  }

  if (!url.pathname.startsWith('/api/')) {
    return context.next()
  }

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
