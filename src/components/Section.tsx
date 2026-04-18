import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  minHeight?: string
  contentPosition?: 'top' | 'bottom'
}

function Section({
  id,
  anchor,
  children,
  minHeight = '100dvh',
  contentPosition = 'top',
}: SectionProps) {
  const sectionAnchor = anchor ?? id

  const sectionStyle: React.CSSProperties = {
    minHeight,
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
      className={styles.section}
      style={sectionStyle}
    >
      {children}
    </section>
  )
}

export default Section
