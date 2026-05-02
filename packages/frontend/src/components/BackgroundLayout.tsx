'use client'

import { useEffect, useState } from 'react'
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
        <div className={styles.nav}>
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
