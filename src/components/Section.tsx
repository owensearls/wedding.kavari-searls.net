import type { ReactNode } from 'react'
import styles from './Section.module.css'

interface SectionProps {
  id: string
  anchor?: string
  children: ReactNode
  minHeight?: string
}

function Section({ id, anchor, children, minHeight = '100vh' }: SectionProps) {
  return (
    <section
      id={id}
      data-anchor={anchor || id}
      className={styles.section}
      style={{ minHeight }}
    >
      {children}
    </section>
  )
}

export default Section
