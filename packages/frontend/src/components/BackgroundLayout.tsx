'use client'

import { useEffect, useRef, useState } from 'react'
import { AnchorContext } from './AnchorContext'
import { Backdrop } from './Backdrop'
import styles from './BackgroundLayout.module.css'
import { Section } from './Section'
import { Chevron } from './ui/icons/Chevron'
import type { ReactNode } from 'react'

interface BackgroundLayoutProps {
  children?: ReactNode
  header?: ReactNode
  footer?: ReactNode
}

export function BackgroundLayout({
  children,
  header,
  footer,
}: BackgroundLayoutProps) {
  const [currentAnchor, setCurrentAnchor] = useState('')
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll('[data-anchor]')
    ) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const anchor = (entry.target as HTMLElement).getAttribute(
            'data-anchor'
          )
          if (anchor === null) return
          setCurrentAnchor(anchor)
          const newHash = anchor === '' || anchor === 'home' ? '' : `#${anchor}`
          if (window.location.hash !== newHash) {
            window.history.replaceState(
              null,
              '',
              newHash || window.location.pathname
            )
          }
        })
      },
      {
        // Fire when a section crosses the viewport's center line — robust
        // for sections taller than the viewport (which never reach a 0.5
        // intersection ratio).
        root: scrollerRef.current,
        threshold: 0,
        rootMargin: '-50% 0px -50% 0px',
      }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  let navData: {
    href: string
    text: string
    direction: 'up' | 'down'
  } = { href: '', text: '', direction: 'up' }
  if (currentAnchor === '') {
    navData = { href: '#faq', text: 'FAQ', direction: 'up' }
  } else if (currentAnchor === 'faq') {
    navData = { href: '#rsvp', text: 'RSVP', direction: 'up' }
  } else if (currentAnchor === 'rsvp') {
    navData = { href: '#home', text: 'Home', direction: 'down' }
  } else if (currentAnchor === 'footer') {
    navData = { href: '#home', text: 'Home', direction: 'up' }
  }

  // Layer structure: one document-spanning artwork layer (the
  // full-screen-locked background), transparent spacers above and below
  // the viewport shell, and the transparent shell itself holding the
  // nav overlay, the single scroll container, and the mountains.
  //
  // iOS 26 note: only in-flow / document-space paint renders in the
  // surface Safari extends behind the notch and chrome — fixed layers
  // are confined to the inner viewport (confirmed on device). Nothing
  // in this layout uses position: fixed.
  //
  // The scroller (marked data-scroll-root for the initial-scroll script)
  // owns all scrolling; mandatory snapping keeps exactly one section on
  // screen at rest, and tabIndex keeps keyboard scrolling working even
  // though the document root never scrolls.
  return (
    <AnchorContext.Provider value={currentAnchor}>
      {/* One full-screen-locked background layer spanning the whole
          document (spacers included), with the transparent scrolling
          shell layered on top. The page loads parked past the top
          spacer (see the initial-scroll script) so document pixels sit
          under the status-bar edge effect; the root snap keeps it
          parked. */}
      <Backdrop className={styles.artwork} />
      <div className={styles.edgeRunwayTop} data-edge-runway-top="" />
      <div className={styles.container}>
        <div className={styles.nav}>
          <div className={styles.navContent}>
            <a href={navData.href} className={styles.navLink}>
              <Chevron direction={navData.direction} /> {navData.text}
            </a>
          </div>
        </div>
        <div
          ref={scrollerRef}
          className={styles.scroller}
          data-scroll-root=""
          tabIndex={-1}
        >
          <div className={styles.content}>
            <div className={styles.contentInner}>
              {children}
              <Section id="home" anchor="" contentPosition="center">
                {header}
              </Section>
            </div>
            <div className={styles.footerContent}>
              <Section
                id="footer"
                anchor="footer"
                minHeight="100dvh"
                contentPosition="bottom"
              >
                <div className={styles.creditsFlow}>{footer}</div>
              </Section>
            </div>
          </div>
        </div>
        <div className={styles.footerFixed}>
          <picture>
            <source srcSet="/mountains.avif" type="image/avif" />
            <img
              src="/mountains.png"
              width={2687}
              height={1931}
              className={styles.footerImage}
              data-mountains=""
              alt="Watercolor painting of Mt. Ascutney, Vermont"
            />
          </picture>
        </div>
        {/* Visual copy of the credits, anchored in the same document
            space as the mountains (which provably reaches the physical
            screen bottom on iOS 26) rather than inside the clipped
            scroller. Revealed by the footer's view timeline; the
            in-flow copy in the footer Section stays for screen readers
            and for browsers without scroll-driven animations. */}
        <div className={styles.creditsFixed} aria-hidden="true">
          {footer}
        </div>
      </div>
      <div
        className={styles.edgeRunwayBottom}
        data-edge-runway-bottom=""
        aria-hidden="true"
      />
    </AnchorContext.Provider>
  )
}

export { type BackgroundLayoutProps }
