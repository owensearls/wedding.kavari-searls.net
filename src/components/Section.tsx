import type { ReactNode } from 'react'
import { useCurrentAnchor } from './AnchorContext'
import styles from './Section.module.css'

interface SectionProps {
  id: string
  anchor?: string
  children?: ReactNode
  minHeight?: string
}

function Section({ id, anchor, children, minHeight = '100vh' }: SectionProps) {
  const currentAnchor = useCurrentAnchor()
  const sectionAnchor = anchor ?? id
  const isActive = currentAnchor === sectionAnchor

  return (
    <section
      id={id}
      data-anchor={sectionAnchor}
      className={styles.section}
      style={{ minHeight }}
    >
      <div style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.1s ease' }}>
        {children}
      </div>
    </section>
  )
}

export default Section
