import { App } from './App'

export function Root({ url: _url }: { url: URL }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>Kavari-Searls Wedding</title>
        <meta property="og:title" content="Kavari-Searls Wedding" />
        <meta property="og:type" content="website" />
      </head>
      <body>
        <div id="root">
          <App />
        </div>
      </body>
    </html>
  )
}

// Server-only file; not subject to Fast Refresh boundaries.
// eslint-disable-next-line react-refresh/only-export-components
export async function getStaticPaths(): Promise<string[]> {
  return ['/']
}
