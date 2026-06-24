import './PageLayout.css'
import { BackgroundCanvas } from '../BackgroundCanvas'
import type { ReactNode } from 'react'

interface PageLayoutProps {
  title: string
  children: ReactNode
}

const initialScrollScript = `(function(){
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var hash = location.hash.slice(1);
  var el = document.getElementById(hash || 'home');
  if (!el) return;
  try { window.scrollTo({ top: el.offsetTop - 44, behavior: 'instant' }); }
  catch (e) { document.documentElement.scrollTop = el.offsetTop - 44; }
})();`

export function PageLayout({ title, children }: PageLayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <link
          rel="preload"
          as="image"
          href="/background.avif"
          type="image/avif"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/mountains.avif"
          type="image/avif"
          fetchPriority="high"
        />
        <title>{title}</title>
      </head>
      <body>
        {/* Top: a static solid strip Safari samples to tint the top bar (sky).
            Bottom: a <canvas> in the bottom safe-area strip painting the
            gradient colour for the current scroll position. A canvas has no
            background-color for Safari to sample, so this tests whether the
            translucent bottom bar composites the canvas's live pixels (which
            we can animate) instead — see BackgroundCanvas. */}
        <div className="chromeTint chromeTint--top" aria-hidden="true" />
        <BackgroundCanvas />
        {children}
        <script dangerouslySetInnerHTML={{ __html: initialScrollScript }} />
      </body>
    </html>
  )
}
