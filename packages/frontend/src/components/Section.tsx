import styles from './Section.module.css'
import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  minHeight?: string
  contentPosition?: 'top' | 'center' | 'bottom'
  /**
   * Pageable content section: exactly one viewport tall in the page
   * scroller, with its content scrolling in a nested scroller inside.
   * The page scroller's only snap positions are section tops, so
   * moving between sections ALWAYS lands at the top of the target
   * section — from either direction, with no scripted correction.
   * Gestures over the content scroll it first; at its boundary the
   * scroll chains out and pages to the neighboring section. The layout
   * resets the inner scroller when the section leaves view, so a
   * section is always re-entered at the top of its content.
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

  const sectionStyle: React.CSSProperties = scrollable
    ? // Fixed at one viewport: the section must never grow with its
      // content, or the snap geometry gains mid-content rest positions.
      { height: minHeight }
    : {
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
        <div className={styles.sectionScroller} data-section-scroller="">
          <div className={styles.sectionContent}>{children}</div>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
