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

  // Section entry correction: CSS snapping alone can rest a
  // cross-section entry away from the section's start — an upward
  // entry into a taller-than-viewport section lands at its content END
  // (the nearest position where the oversized snap area covers the
  // snapport), and a hard fling downward can overshoot a boundary into
  // mid-content. Reading flows top-down, so a scroll that leaves its
  // section is redirected to the new section's start. The redirect
  // fires PREEMPTIVELY, on the first scroll frame where the gesture
  // has committed to the new section (position inside its
  // fully-covering range, pointer already lifted), so there is no
  // visible settle-then-glide double motion; a settle-time pass
  // backstops anything the early redirect missed. Scrolling within a
  // section is untouched, and small ticks that snap back never cross
  // the commit threshold.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const sections = Array.from(
      scroller.querySelectorAll('section[id]')
    ) as HTMLElement[]
    if (sections.length === 0) return

    // Scroll offsets of the section tops, robust to nested positioned
    // wrappers; recomputed per event so resizes stay correct.
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
    let dragging = false
    let correcting = false

    const correctTo = (top: number) => {
      correcting = true
      scroller.scrollTo({ top, behavior: 'smooth' })
    }

    const onScroll = () => {
      if (dragging || correcting) return
      const y = scroller.scrollTop
      const tops = sectionTops()
      const curTop = topOfSectionAt(y, tops)
      if (curTop === topOfSectionAt(prevRest, tops) || y <= curTop + 2) return
      // Committed to the new section only once it fully covers the
      // viewport — positions short of that may still snap back to the
      // origin section.
      const next = tops[tops.indexOf(curTop) + 1]
      const sectionEnd = next !== undefined ? next : scroller.scrollHeight
      if (y <= sectionEnd - scroller.clientHeight + 2) correctTo(curTop)
    }

    // scrollend fires once per settled gesture (including after the
    // snap animation); a scroll-quiet timer fills in where it is
    // unsupported. Records the rest position and backstops any
    // cross-section landing the early redirect missed.
    const settle = () => {
      correcting = false
      const y = scroller.scrollTop
      const tops = sectionTops()
      const curTop = topOfSectionAt(y, tops)
      const prevTop = topOfSectionAt(prevRest, tops)
      if (curTop !== prevTop && y > curTop + 2) {
        prevRest = curTop
        correctTo(curTop)
        return
      }
      prevRest = y
    }

    const onPointerDown = () => {
      dragging = true
      correcting = false
    }
    const onPointerUp = () => {
      dragging = false
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const supportsScrollEnd = 'onscrollend' in window
    const onScrollWithFallback = () => {
      onScroll()
      if (!supportsScrollEnd) {
        clearTimeout(timer)
        timer = setTimeout(settle, 150)
      }
    }
    scroller.addEventListener('scroll', onScrollWithFallback, {
      passive: true,
    })
    if (supportsScrollEnd) scroller.addEventListener('scrollend', settle)
    scroller.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      clearTimeout(timer)
      scroller.removeEventListener('scroll', onScrollWithFallback)
      scroller.removeEventListener('scrollend', settle)
      scroller.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
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
