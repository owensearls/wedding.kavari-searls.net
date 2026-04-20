import { AdminRoot } from './admin/AdminRoot'

export function Root({ url }: { url: URL }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>Admin · RSVP</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <div id="root">
          <AdminRoot location={url.pathname + url.search} />
        </div>
      </body>
    </html>
  )
}
