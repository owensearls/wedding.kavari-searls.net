// Pages Functions middleware. Catches uncaught errors in any /api handler so
// the client always receives a JSON response instead of an HTML error page.

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
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
