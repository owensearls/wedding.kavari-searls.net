'use client'

import { useEffect, useRef, useState } from 'react'
import { AnchorContext } from './AnchorContext'
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
  const [navOverText, setNavOverText] = useState(false)
  const navRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let rafId = 0
    const update = () => {
      rafId = 0
      const navEl = navRef.current
      if (!navEl) return
      const navRect = navEl.getBoundingClientRect()
      const textEls = document.querySelectorAll<HTMLElement>('h1, h2, h3, p')
      let over = false
      for (const el of textEls) {
        if (navEl.contains(el)) continue
        const r = el.getBoundingClientRect()
        if (r.bottom > navRect.top && r.top < navRect.bottom) {
          over = true
          break
        }
      }
      setNavOverText(over)
    }
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

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
      { root: null, threshold: 0.5, rootMargin: '-10% 0px -10% 0px' }
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

  return (
    <AnchorContext.Provider value={currentAnchor}>
      <div className={styles.container}>
        <div
          className={styles.nav}
          ref={navRef}
          data-over-text={navOverText ? 'true' : undefined}
        >
          <div className={styles.navContent}>
            <a href={navData.href} className={styles.navLink}>
              <Chevron direction={navData.direction} /> {navData.text}
            </a>
          </div>
        </div>
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
    </AnchorContext.Provider>
  )
}

export { type BackgroundLayoutProps }
