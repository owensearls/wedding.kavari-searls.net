import { AdminRoot } from './admin/AdminRoot'
import { App } from './App'

export function Root({ url }: { url: URL }) {
  const isAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/')
  const title = isAdmin
    ? 'Admin · Kavari-Searls Wedding'
    : 'Kavari-Searls Wedding'
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>{title}</title>
        {isAdmin ? (
          <meta name="robots" content="noindex,nofollow" />
        ) : (
          <>
            <meta property="og:title" content="Kavari-Searls Wedding" />
            <meta property="og:type" content="website" />
          </>
        )}
      </head>
      <body>
        <div id="root">
          {isAdmin ? (
            <AdminRoot location={url.pathname + url.search} />
          ) : (
            <App />
          )}
        </div>
      </body>
    </html>
  )
}

// Server-only file; not subject to Fast Refresh boundaries.
// eslint-disable-next-line react-refresh/only-export-components
export async function getStaticPaths(): Promise<string[]> {
  return ['/', '/admin/', '/admin/groups/', '/admin/import/', '/admin/events/']
}
