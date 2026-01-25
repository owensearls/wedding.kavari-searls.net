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
    const image = imageRef.current
    if (!container || !image) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const maxScroll = scrollHeight - clientHeight

      // Calculate mountain height: grows from 50vh to 75vh based on scroll
      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0
      const newHeight = 50 + (scrollProgress * 25) // 50vh to 75vh

      setMountainHeight(Math.min(newHeight, 75))

      // Stop scrolling when mountains reach 75vh
      if (newHeight >= 75) {
        // Prevent scrolling beyond this point by limiting scroll position
        const maxScrollForFullMountains = maxScroll * (25 / 25) // At 100% progress
        if (scrollTop > maxScrollForFullMountains) {
          container.scrollTop = maxScrollForFullMountains
        }
      }
    }

    const handleWheel = (e: WheelEvent) => {
      const scrollTop = container.scrollTop
      const scrollHeight = container.scrollHeight
      const clientHeight = container.clientHeight
      const maxScroll = scrollHeight - clientHeight

      const scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0

      // Prevent scrolling DOWN beyond the point where mountains are at 75vh
      if (scrollProgress >= 1 && e.deltaY > 0) {
        e.preventDefault()
      }
      // Allow scrolling UP at any time (e.deltaY < 0 means scrolling up)
    }

    container.addEventListener('scroll', handleScroll)
    container.addEventListener('wheel', handleWheel, { passive: false })

    // Initial check
    handleScroll()

    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('wheel', handleWheel)
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
