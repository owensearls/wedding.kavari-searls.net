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

  // Cross-section scrolls must land at the destination section's top —
  // reading flows top-down — but CSS snapping alone rests an upward
  // entry into a taller-than-viewport section at its content END (the
  // nearest position where the oversized snap area covers the
  // viewport), and a hard fling can rest mid-content. The correction
  // takes over the moment a gesture passes the point of no return —
  // half a viewport past the origin section's boundary, where the
  // native snap can no longer rest back in the origin section, so the
  // destination section is already decided — and glides to that
  // section's top starting at the gesture's current velocity. The
  // handoff is one continuous motion: no settling at the wrong spot
  // first, no second animation. Scrolling within a section never
  // crosses the threshold and stays fully native.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const sections = Array.from(
      scroller.querySelectorAll('section[id]')
    ) as HTMLElement[]
    if (sections.length === 0) return

    // Scroll offsets of the section tops, robust to nested positioned
    // wrappers; recomputed per use so resizes stay correct.
    const sectionTops = () =>
      sections
        .map(
          (s) =>
            s.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop
        )
        .sort((a, b) => a - b)

    const indexAt = (y: number, tops: number[]) => {
      let index = 0
      for (let i = 0; i < tops.length; i++) if (tops[i] <= y + 2) index = i
      return index
    }

    let restTop = scroller.scrollTop
    let timer: ReturnType<typeof setTimeout> | undefined
    let dragging = false
    let gliding = false
    // Anchor navigation (the nav links) smooth-scrolls THROUGH
    // intermediate sections; those frames must not be mistaken for a
    // gesture. Set on hashchange, cleared once the scroll settles.
    let navigating = false
    // Trackpads pan via a stream of wheel events; taking over
    // mid-stream would hijack a scroll still under the user's fingers.
    let wheelUntil = 0
    // Gesture velocity, sampled across scroll frames, so the glide can
    // start at the speed the scroll is already moving.
    let lastY = scroller.scrollTop
    let lastTime = performance.now()
    let velocity = 0

    let glideRaf = 0
    const cancelGlide = () => {
      cancelAnimationFrame(glideRaf)
      gliding = false
    }

    // Manual rAF glide instead of scrollTo({behavior:'smooth'}): iOS
    // swallows programmatic smooth scrolls around its native
    // momentum/snap animations, while direct scrollTop writes CANCEL
    // the native animation and take over.
    const glideTo = (top: number) => {
      cancelAnimationFrame(glideRaf)
      const from = scroller.scrollTop
      const dist = top - from
      restTop = top
      if (Math.abs(dist) < 1) return
      gliding = true
      const speed = Math.max(Math.abs(velocity), 0.3)
      const duration = Math.min(650, Math.max(250, Math.abs(dist) / speed))
      // Cubic ease from (0,0) to (1,1) whose slope starts at the
      // handed-over velocity (c, in eased-time units) and ends at 0 —
      // the takeover is invisible because the motion never changes
      // speed abruptly.
      const c = Math.max(0, Math.min(2.5, (velocity * duration) / dist))
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = (c - 2) * t ** 3 + (3 - 2 * c) * t ** 2 + c * t
        scroller.scrollTop = from + dist * eased
        if (t < 1) glideRaf = requestAnimationFrame(step)
        else gliding = false
      }
      glideRaf = requestAnimationFrame(step)
    }

    const onScrollFrame = () => {
      const now = performance.now()
      const y = scroller.scrollTop
      velocity = (y - lastY) / Math.max(now - lastTime, 1)
      lastY = y
      lastTime = now
      if (gliding || dragging || navigating || now < wheelUntil) return
      const tops = sectionTops()
      const origin = indexAt(restTop, tops)
      const commit = scroller.clientHeight / 2
      if (origin > 0 && y <= tops[origin] - commit) {
        glideTo(tops[indexAt(y, tops)])
      } else if (origin + 1 < tops.length && y >= tops[origin + 1] - commit) {
        glideTo(tops[Math.max(indexAt(y, tops), origin + 1)])
      }
    }

    // Backstop for any cross-section rest the takeover missed (e.g. a
    // native snap settling an upward entry at the section's content
    // end before a commit frame fired). Driven by BOTH scrollend and a
    // scroll-quiet timer — WebKit fires scrollend unreliably around
    // snap animations. It corrects only a genuine rest: still moving,
    // or stopped between sections (a native animation's transient
    // position — momentum can gap scroll events long enough to look
    // quiet), means the native scroll is left to finish and the next
    // settle decides. Same-section settles are no-ops.
    const settle = () => {
      if (gliding || dragging) return
      if (Math.abs(velocity) > 0.1) {
        velocity = 0
        timer = setTimeout(settle, 200)
        return
      }
      navigating = false
      const y = scroller.scrollTop
      const tops = sectionTops()
      const cur = indexAt(y, tops)
      const coveringEnd = Math.max(
        tops[cur],
        (tops[cur + 1] ?? scroller.scrollHeight) - scroller.clientHeight
      )
      if (
        cur !== indexAt(restTop, tops) &&
        y > tops[cur] + 8 &&
        y <= coveringEnd + 2
      ) {
        velocity = 0
        glideTo(tops[cur])
        return
      }
      restTop = y
    }

    // Finger state comes from touch events: once native scrolling
    // claims a touch the browser fires pointercancel, so pointer
    // events would report the finger lifted mid-drag and let the
    // takeover fight a scroll still under the user's finger. Pointer
    // events cover the mouse (e.g. scrollbar drags) only.
    const grab = () => {
      // User takeover cancels any in-flight glide or navigation state.
      dragging = true
      cancelGlide()
      navigating = false
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) dragging = false
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') grab()
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') dragging = false
    }
    const onWheel = () => {
      wheelUntil = performance.now() + 120
      // A tick during the glide hands control back to the user.
      cancelGlide()
    }
    const onHashChange = () => {
      navigating = true
    }

    const onScrollTick = () => {
      onScrollFrame()
      clearTimeout(timer)
      timer = setTimeout(settle, 160)
    }
    const onScrollEnd = () => {
      clearTimeout(timer)
      settle()
    }
    scroller.addEventListener('scroll', onScrollTick, { passive: true })
    scroller.addEventListener('scrollend', onScrollEnd)
    scroller.addEventListener('touchstart', grab, { passive: true })
    scroller.addEventListener('pointerdown', onPointerDown)
    scroller.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(glideRaf)
      scroller.removeEventListener('scroll', onScrollTick)
      scroller.removeEventListener('scrollend', onScrollEnd)
      scroller.removeEventListener('touchstart', grab)
      scroller.removeEventListener('pointerdown', onPointerDown)
      scroller.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('hashchange', onHashChange)
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
