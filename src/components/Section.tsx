import type { ReactNode } from 'react'
import { useCurrentAnchor } from './AnchorContext'
import styles from './Section.module.css'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  minHeight?: string
  contentPosition?: 'top' | 'bottom'
}

function Section({ id, anchor, children, minHeight = '100vh', contentPosition = 'top' }: SectionProps) {
  const currentAnchor = useCurrentAnchor()
  const sectionAnchor = anchor ?? id
  const isActive = currentAnchor === sectionAnchor

  const sectionStyle: React.CSSProperties = {
    minHeight,
    ...(contentPosition === 'bottom' && {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    })
  }

  return (
    <section
      id={id}
      data-anchor={sectionAnchor}
      className={styles.section}
      style={sectionStyle}
    >
      <div style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.1s ease' }}>
        {children}
      </div>
    </section>
  )
}

export default Section
