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

  // Directional entry correction: CSS snapping alone rests an upward
  // entry into a taller-than-viewport section at its content END (the
  // nearest position where the oversized snap area covers the
  // snapport). Reading flows top-down, so when a scroll settles in a
  // section ABOVE the one it started from — and not at its start —
  // glide to the section's start. Downward travel and scrolling within
  // a section are untouched.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const sections = Array.from(
      scroller.querySelectorAll('section[id]')
    ) as HTMLElement[]
    if (sections.length === 0) return

    // Scroll offset of each section's top, robust to nested positioned
    // wrappers; recomputed per settle so resizes stay correct.
    const sectionTops = () =>
      sections
        .map(
          (s) =>
            s.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop
        )
        .sort((a, b) => a - b)

    const topOfSectionAt = (y: number, tops: number[]) => {
      let top = tops[0]
      for (const t of tops) if (t <= y + 2) top = t
      return top
    }

    let prevRest = scroller.scrollTop
    const settle = () => {
      const y = scroller.scrollTop
      const tops = sectionTops()
      const curTop = topOfSectionAt(y, tops)
      const prevTop = topOfSectionAt(prevRest, tops)
      if (curTop < prevTop && y > curTop + 2) {
        prevRest = curTop
        scroller.scrollTo({ top: curTop, behavior: 'smooth' })
        return
      }
      prevRest = y
    }

    // scrollend fires once per settled gesture (including after the
    // snap animation); fall back to a scroll-quiet timer where it is
    // unsupported.
    let timer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(settle, 150)
    }
    const supportsScrollEnd = 'onscrollend' in window
    if (supportsScrollEnd) {
      scroller.addEventListener('scrollend', settle)
    } else {
      scroller.addEventListener('scroll', onScroll, { passive: true })
    }
    return () => {
      clearTimeout(timer)
      scroller.removeEventListener('scrollend', settle)
      scroller.removeEventListener('scroll', onScroll)
    }
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
