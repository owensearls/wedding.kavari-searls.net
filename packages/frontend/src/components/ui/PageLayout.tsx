import './PageLayout.css'
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
  var scroller = document.querySelector('[data-scroll-root]');
  var top = scroller
    ? el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    : el.offsetTop;
  try { (scroller || window).scrollTo({ top: top, behavior: 'instant' }); }
  catch (e) { (scroller || document.documentElement).scrollTop = top; }
  var runway = document.querySelector('[data-edge-runway-top]');
  if (runway) {
    try { window.scrollTo({ top: runway.offsetHeight, behavior: 'instant' }); }
    catch (e) { document.documentElement.scrollTop = runway.offsetHeight; }
  }
  if (scroller) scroller.focus({ preventScroll: true });
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
        {/* Ignored by Safari 26 (it samples page colors instead) but still
            drives the browser UI color on Android and installed PWAs. */}
        <meta name="theme-color" content="#cccec0" />
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
        {children}
        <script dangerouslySetInnerHTML={{ __html: initialScrollScript }} />
      </body>
    </html>
  )
}
