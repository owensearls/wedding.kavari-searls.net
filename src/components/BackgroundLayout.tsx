import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import styles from './BackgroundLayout.module.css'

interface BackgroundLayoutProps {
  children?: ReactNode
}

function BackgroundLayout({ children }: BackgroundLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [mountainHeight, setMountainHeight] = useState(50)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Set initial scroll position to hide FAQ above viewport
    const faqElement = document.getElementById('faq')
    if (faqElement) {
      container.scrollTop = faqElement.offsetHeight
    }
  }, [])

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

          const faqElement = document.getElementById('faq')
          const faqHeight = faqElement ? faqElement.offsetHeight : 0

          // Calculate scroll position relative to FAQ
          // When at FAQ top (scrollTop = 0), mountains should be hidden (0vh)
          // When at main content (scrollTop = faqHeight), mountains should be 50vh
          // When scrolled down further, mountains grow to 75vh

          if (scrollTop < faqHeight) {
            // In FAQ area - mountains scale from 0vh to 50vh
            const faqProgress = faqHeight > 0 ? scrollTop / faqHeight : 0
            setMountainHeight(faqProgress * 50)
          } else {
            // Below FAQ - mountains scale from 50vh to 75vh
            const scrollBelowFaq = scrollTop - faqHeight
            const maxScrollBelowFaq = (scrollHeight - clientHeight) - faqHeight
            const scrollProgress = maxScrollBelowFaq > 0 ? scrollBelowFaq / maxScrollBelowFaq : 0
            const newHeight = 50 + (scrollProgress * 25)
            setMountainHeight(Math.min(newHeight, 75))
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
  }, [])

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.content}>
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
      <div className={styles.scrollbarOverlay} />
    </div>
  )
}

export default BackgroundLayout
