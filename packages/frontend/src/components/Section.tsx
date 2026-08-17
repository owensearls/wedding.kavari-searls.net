import styles from './Section.module.css'
import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  minHeight?: string
  contentPosition?: 'top' | 'center' | 'bottom'
  /**
   * Pageable content section: at least one viewport tall, growing with
   * its content — all in the single page scroller. Its snap area being
   * taller than the viewport means the scroller rests anywhere the
   * section covers the screen (free reading through long content) but
   * never straddling two sections; reaching the content's end, the next
   * gesture pages to the neighboring section. One scroller, no nested
   * scrolling modes.
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
    minHeight,
    ...(contentPosition !== 'top' && {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: contentPosition === 'bottom' ? 'flex-end' : 'center',
    }),
  }

  return (
    <section
      id={id}
      data-anchor={sectionAnchor}
      className={styles.section}
      style={sectionStyle}
    >
      {scrollable ? (
        <>
          <div className={styles.sectionContent}>{children}</div>
          <div className={styles.endSnap} aria-hidden="true" />
        </>
      ) : (
        children
      )}
    </section>
  )
}
