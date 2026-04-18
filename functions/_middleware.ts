// Admin SPA fallback — serve admin/index.html for any /admin path
// that isn't a static asset, so client-side routing works.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)

  if (url.pathname.startsWith('/admin') && !url.pathname.match(/\.\w+$/)) {
    const res = await context.env.ASSETS.fetch(
      new URL('/admin/index.html', url.origin),
    )
    return new Response(res.body, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  return context.next()
}
