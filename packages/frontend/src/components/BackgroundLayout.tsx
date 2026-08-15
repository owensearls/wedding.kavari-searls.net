'use client'

import { useEffect, useRef, useState } from 'react'
import { AnchorContext } from './AnchorContext'
import styles from './BackgroundLayout.module.css'
import { GlassCanvas } from './GlassCanvas'
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
        root: scrollerRef.current,
        threshold: 0.5,
        rootMargin: '-10% 0px -10% 0px',
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

  // Layer structure: `.container` fills the viewport in normal flow (the
  // root can't scroll, so it never moves), holding the page as explicit
  // layers: the full-bleed artwork backdrop, the nav overlay, the single
  // scroll container, the pinned mountains, and the GlassCanvas mirrors.
  //
  // iOS 26 Liquid Glass constraint (validated on device — see the
  // research doc and the PR #13 diagnostic): Safari tints its glass bars
  // by sampling the background-color of position:fixed/sticky elements
  // near the viewport edges, falling back to the body color, and any
  // sampled opaque color renders the bar as a SOLID block that hides the
  // page. The only way real pixels appear behind the glass is canvas
  // compositing. So nothing on this page exposes a background-color to
  // the sampler — no fixed/sticky element carries one and the body is
  // transparent — while the GlassCanvas layers provide live artwork
  // pixels for the glass to composite.
  //
  // The scroller (marked data-scroll-root for the initial-scroll script)
  // owns all scrolling; mandatory snapping keeps exactly one section on
  // screen at rest, and tabIndex keeps keyboard scrolling working even
  // though the document root never scrolls.
  return (
    <AnchorContext.Provider value={currentAnchor}>
      <div className={styles.container}>
        <div
          className={styles.backdrop}
          data-background=""
          aria-hidden="true"
        />
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
              <Section id="home" anchor="">
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
                {footer}
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
              alt="Watercolor painting of Mt. Ascutney, Vermont"
            />
          </picture>
        </div>
        <GlassCanvas scrollerRef={scrollerRef} />
      </div>
    </AnchorContext.Provider>
  )
}

export { type BackgroundLayoutProps }
