import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import styles from './BackgroundLayout.module.css'

interface BackgroundLayoutProps {
  children?: ReactNode
  footer?: ReactNode
}

function BackgroundLayout({ children, footer }: BackgroundLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
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

    const handleImageLoad = () => {
      const naturalHeight = image.naturalHeight
      const viewportHeight = window.innerHeight
      const heightInVh = (naturalHeight / viewportHeight) * 100
      setMountainNaturalHeightVh(heightInVh)
    }

    if (image.complete) {
      handleImageLoad()
    } else {
      image.addEventListener('load', handleImageLoad)
      return () => image.removeEventListener('load', handleImageLoad)
    }
  }, [])

  // Handle initial scroll position based on URL hash - runs immediately, before IntersectionObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container || initialScrollSetRef.current) return

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      const hash = window.location.hash.slice(1)

      if (hash) {
        // Scroll to specific section
        setCurrentAnchor(hash)
        const section = document.querySelector(`[data-anchor="${hash}"]`)
        if (section) {
          container.scrollTo({
            top: (section as HTMLElement).offsetTop,
            behavior: 'instant'
          })
        }
      } else {
        // No hash - scroll to home section
        setCurrentAnchor('')
        const sections = container.querySelectorAll('[data-anchor]')
        if (sections.length > 0) {
          const homeSection = Array.from(sections).find(
            (s) => s.getAttribute('data-anchor') === '' || s.getAttribute('data-anchor') === 'home'
          )
          if (homeSection) {
            container.scrollTo({
              top: (homeSection as HTMLElement).offsetTop,
              behavior: 'instant'
            })
          }
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
    const container = containerRef.current
    if (!container) return

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      setCurrentAnchor(hash)
      const section = hash
        ? document.querySelector(`[data-anchor="${hash}"]`)
        : document.querySelector('[data-anchor=""], [data-anchor="home"]')

      if (section) {
        container.scrollTo({
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
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return

    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = container.scrollTop
          const scrollHeight = container.scrollHeight
          const clientHeight = container.clientHeight

          // Find all sections
          const sections = Array.from(container.querySelectorAll('[data-anchor]')) as HTMLElement[]
          if (sections.length === 0) {
            ticking = false
            return
          }

          // Find home section (first section after any sections above it)
          const homeSection = sections.find(
            (s) => s.getAttribute('data-anchor') === '' || s.getAttribute('data-anchor') === 'home'
          ) || sections[0]

          const homeSectionTop = homeSection.offsetTop
          const sectionsAboveHome = sections.filter(s => s.offsetTop < homeSectionTop)
          const sectionsAboveHeight = sectionsAboveHome.reduce((sum, s) => sum + s.offsetHeight, 0)

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

          ticking = false
        })

        ticking = true
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    // Initial check
    handleScroll()

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [mountainNaturalHeightVh])

  // Update URL hash on snap with IntersectionObserver - only after initialization
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isInitialized) return

    const sections = Array.from(container.querySelectorAll('[data-anchor]')) as HTMLElement[]
    if (sections.length === 0) return

    const observerOptions = {
      root: container,
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

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ visibility: isInitialized ? 'visible' : 'hidden' }}
    >
      <div ref={contentRef} className={styles.content}>
        <div className={styles.contentInner}>
          {children}
        </div>
      </div>
      <img
        ref={imageRef}
        src="/mountains.png"
        className={styles.footerImage}
        style={{ maxHeight: `${mountainHeight}vh` }}
        alt="Mountains"
      />
      {footer && (
        <div
          ref={footerRef}
          className={styles.footer}
          style={{
            bottom: '25px',
            opacity: currentAnchor === 'footer' ? 1 : 0,
            transition: 'opacity 0.1s ease'
          }}
        >
          <div className={styles.footerContent}>
            {footer}
          </div>
        </div>
      )}
      <div className={styles.scrollbarOverlay} />
    </div>
  )
}

export { type BackgroundLayoutProps }
export default BackgroundLayout
