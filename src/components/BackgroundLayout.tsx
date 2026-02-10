import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faAngleDown, faAngleUp} from '@fortawesome/free-solid-svg-icons'
import { AnchorContext } from './AnchorContext'
import styles from './BackgroundLayout.module.css'
import Section from './Section'

interface BackgroundLayoutProps {
  children?: ReactNode
  header?: ReactNode
  footer?: ReactNode
}

function BackgroundLayout({ children, header, footer }: BackgroundLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [mountainHeight, setMountainHeight] = useState(50)
  const [mountainNaturalHeightVh, setMountainNaturalHeightVh] = useState(100)
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentAnchor, setCurrentAnchor] = useState('')
  const initialScrollSetRef = useRef(false)

  // Calculate mountain natural height in vh units
  useEffect(() => {
    const image = imageRef.current
    if (!image) return

    const calculateDisplayHeight = () => {
      if (!image.complete || image.naturalWidth === 0) return
      // Calculate displayed height based on actual render constraints
      // The image has max-width: 2000px and maintains aspect ratio
      const aspectRatio = image.naturalHeight / image.naturalWidth
      const viewportWidth = window.innerWidth
      const displayWidth = Math.min(image.naturalWidth, Math.min(2000, viewportWidth))
      const displayHeight = displayWidth * aspectRatio
      const heightInVh = (displayHeight / window.innerHeight) * 100
      setMountainNaturalHeightVh(heightInVh)
    }

    if (image.complete) {
      calculateDisplayHeight()
    } else {
      image.addEventListener('load', calculateDisplayHeight)
    }

    // Recalculate on resize since viewport dimensions affect displayed height
    window.addEventListener('resize', calculateDisplayHeight)

    return () => {
      image.removeEventListener('load', calculateDisplayHeight)
      window.removeEventListener('resize', calculateDisplayHeight)
    }
  }, [])

  // Handle initial scroll position based on URL hash - runs immediately, before IntersectionObserver
  useEffect(() => {
    if (initialScrollSetRef.current) return

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const hash = window.location.hash.slice(1)

      if (hash) {
        // Scroll to specific section
        setCurrentAnchor(hash)
        const section = document.querySelector(`[data-anchor="${hash}"]`)
        if (section) {
          window.scrollTo({
            top: (section as HTMLElement).offsetTop,
            behavior: 'instant'
          })
        }
      } else {
        // No hash - scroll to home section
        setCurrentAnchor('')
        const homeSection = document.getElementById('home')
        if (homeSection) {
          window.scrollTo({
            top: homeSection.offsetTop,
            behavior: 'instant'
          })
        }
      }

      initialScrollSetRef.current = true
      // Delay initialization slightly to ensure scroll position is stable
      setTimeout(() => setIsInitialized(true), 50)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [])

  // Handle hash changes from browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      setCurrentAnchor(hash)
      const section = hash
        ? document.querySelector(`[data-anchor="${hash}"]`)
        : document.getElementById('home')

      if (section) {
        window.scrollTo({
          top: (section as HTMLElement).offsetTop,
          behavior: 'smooth'
        })
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Main scroll handler for parallax effect
  useEffect(() => {
    const image = imageRef.current
    if (!image) return

    let ticking = false
    let lastScrollTime = 0
    let pollInterval: ReturnType<typeof setInterval> | null = null

    const updateMountainHeight = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      const homeSection = document.getElementById('home')
      if (!homeSection) {
        return
      }

      // homeSectionTop equals height of all content above home section
      const sectionsAboveHeight = homeSection.offsetTop

      // Calculate scroll position relative to home section
      // When at top of content (scrollTop = 0), mountains should be 0vh
      // When at home section (scrollTop = sectionsAboveHeight), mountains should be 50vh
      // When scrolled down further, mountains grow to show full image

      if (scrollTop < sectionsAboveHeight) {
        // Above home section - mountains scale from 0vh to 50vh
        const progress = sectionsAboveHeight > 0 ? scrollTop / sectionsAboveHeight : 0
        setMountainHeight(progress * 50)
      } else {
        // At or below home section - mountains scale from 50vh to natural height
        const scrollBelowHome = scrollTop - sectionsAboveHeight
        const maxScrollBelowHome = (scrollHeight - clientHeight) - sectionsAboveHeight
        const scrollProgress = maxScrollBelowHome > 0 ? scrollBelowHome / maxScrollBelowHome : 0
        const heightRange = mountainNaturalHeightVh - 50
        const newHeight = 50 + (scrollProgress * heightRange)
        setMountainHeight(Math.min(newHeight, mountainNaturalHeightVh))
      }
    }

    const handleScroll = () => {
      lastScrollTime = Date.now()

      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateMountainHeight()
          ticking = false
        })
        ticking = true
      }

      // Safari momentum scroll workaround: poll for 150ms after last scroll event
      // to catch position updates during momentum deceleration
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          if (Date.now() - lastScrollTime > 150) {
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = null
            }
          } else {
            updateMountainHeight()
          }
        }, 16) // ~60fps
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Initial check
    updateMountainHeight()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [mountainNaturalHeightVh])

  // Update URL hash on snap with IntersectionObserver - only after initialization
  useEffect(() => {
    if (!isInitialized) return

    const sections = Array.from(document.querySelectorAll('[data-anchor]')) as HTMLElement[]
    if (sections.length === 0) return

    const observerOptions = {
      root: null, // Use viewport
      threshold: 0.5,
      rootMargin: '-10% 0px -10% 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const anchor = (entry.target as HTMLElement).getAttribute('data-anchor')
          if (anchor !== null) {
            setCurrentAnchor(anchor)
            const newHash = anchor === '' || anchor === 'home' ? '' : `#${anchor}`
            if (window.location.hash !== newHash) {
              window.history.replaceState(null, '', newHash || window.location.pathname)
            }
          }
        }
      })
    }, observerOptions)

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [isInitialized])

  let navData = {href: '', text: '', icon: faAngleUp}
  if (currentAnchor === '') {
    navData = {href: '#faq', text: 'FAQ', icon: faAngleUp}
  } else if (currentAnchor === 'faq') {
    navData = {href: '#rsvp', text: 'RSVP', icon: faAngleUp}
  } else if (currentAnchor === 'rsvp') {
    navData = {href: '#', text: 'Home', icon: faAngleDown}
  } else if (currentAnchor === 'footer') {
    navData = {href: '#', text: 'Home', icon: faAngleUp}
  }

  return (
    <AnchorContext.Provider value={currentAnchor}>
      <div
        ref={containerRef}
        className={styles.container}
        style={{ visibility: isInitialized ? 'visible' : 'hidden' }}
      >
        <div className={styles.navBackground} />
        <div className={styles.nav}>
          <div className={styles.navContent}>
            <a href={navData.href} className={styles.navLink}>
              <FontAwesomeIcon icon={navData.icon} style={{ verticalAlign: 'middle' }} /> {navData.text}
            </a>
          </div>
        </div>
        <div ref={contentRef} className={styles.content}>
          <div className={styles.contentInner}>
            {children}
            <Section id="home" anchor="">
              {header}
            </Section>
          </div>
          {/* Footer section with content positioned at bottom */}
          <div className={styles.footerContent}>
            <Section id="footer" anchor="footer" minHeight={`${Math.max(0, mountainNaturalHeightVh - 50)}dvh`} contentPosition="bottom">
              {footer}
            </Section>
          </div>
        </div>

        {/* Fixed mountain image */}
        <div className={styles.footerFixed}>
          <img
            ref={imageRef}
            src="/mountains.png"
            className={styles.footerImage}
            style={{ maxHeight: `${mountainHeight}dvh` }}
            alt="Watercolor painting of Mt. Ascutney, Vermont"
          />
        </div>
        <div className={styles.scrollbarOverlay} />
      </div>
    </AnchorContext.Provider>
  )
}

export { type BackgroundLayoutProps }
export default BackgroundLayout
