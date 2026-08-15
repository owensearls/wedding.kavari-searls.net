import styles from './Section.module.css'
import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  /** Fixed height when `scrollable`, minimum height otherwise. */
  minHeight?: string
  contentPosition?: 'top' | 'bottom'
  /**
   * Lock the section to exactly `minHeight` and scroll overflowing content
   * inside it. Reaching either edge of the inner scroller chains back into
   * the page scroll, so content never spills into neighboring sections.
   */
  scrollable?: boolean
}

export function Section({
  id,
  anchor,
  children,
  minHeight = '100dvh',
  contentPosition = 'top',
  scrollable = false,
}: SectionProps) {
  const sectionAnchor = anchor ?? id

  const sectionStyle: React.CSSProperties = {
    ...(scrollable ? { height: minHeight } : { minHeight }),
    ...(contentPosition === 'bottom' && {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }),
  }

  return (
    <section
      id={id}
      data-anchor={sectionAnchor}
      className={
        scrollable
          ? `${styles.section} ${styles.scrollSection}`
          : styles.section
      }
      style={sectionStyle}
    >
      {scrollable ? (
        <div className={styles.sectionScroll}>
          <div className={styles.sectionScrollContent}>{children}</div>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
