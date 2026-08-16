'use client'

import { useEffect, useRef, useState } from 'react'
import { AnchorContext } from './AnchorContext'
import styles from './BackgroundLayout.module.css'
import { EdgeToEdgeLayout } from './EdgeToEdgeLayout'
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

  // Sections are exactly one viewport tall with their content in a
  // nested scroller (see Section), so the page scroller's only snap
  // positions are section tops — entering a section from either
  // direction always lands at its top natively. Reset a section's
  // inner scroller once it fully leaves the viewport, so it is always
  // re-entered at the top of its content.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const inners = Array.from(
      scroller.querySelectorAll('[data-section-scroller]')
    ) as HTMLElement[]
    if (inners.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) return
          const inner = (entry.target as HTMLElement).querySelector(
            '[data-section-scroller]'
          )
          if (inner) inner.scrollTop = 0
        })
      },
      {
        root: scroller,
        threshold: 0,
        // A section resting exactly adjacent to the viewport still
        // "intersects" at ratio 0; shrink the root box a hair so
        // adjacency counts as fully out and the reset fires.
        rootMargin: '-4px 0px -4px 0px',
      }
    )

    inners.forEach((inner) => {
      const section = inner.closest('section')
      if (section) observer.observe(section)
    })
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

  // The main page rides the shared edge-to-edge scaffold and adds its
  // own layers on top: the artwork's parallax drift, mandatory section
  // snapping in the scroller, the nav overlay, and the mountains
  // finale with the anchored credits.
  return (
    <AnchorContext.Provider value={currentAnchor}>
      <EdgeToEdgeLayout
        scrollerRef={scrollerRef}
        artworkClassName={styles.artwork}
        containerClassName={styles.homeContainer}
        scrollerClassName={styles.homeScroller}
        overlays={
          <>
            <div className={styles.nav}>
              <div className={styles.navContent}>
                <a href={navData.href} className={styles.navLink}>
                  <Chevron direction={navData.direction} /> {navData.text}
                </a>
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
                space as the mountains (which provably reaches the
                physical screen bottom on iOS 26) rather than inside the
                clipped scroller. Revealed by the footer's view timeline;
                the in-flow copy in the footer Section stays for screen
                readers and for browsers without scroll-driven
                animations. */}
            <div className={styles.creditsFixed} aria-hidden="true">
              {footer}
            </div>
          </>
        }
      >
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
      </EdgeToEdgeLayout>
    </AnchorContext.Provider>
  )
}

export { type BackgroundLayoutProps }
