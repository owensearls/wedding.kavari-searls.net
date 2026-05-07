import styles from './SectionLabel.module.css'
import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  // Render the label inline with trailing content (e.g., an "Add" button).
  // When true, children is the label text and `action` is the trailing content.
  action?: ReactNode
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  if (action) {
    return (
      <div className={styles.row}>
        <span className={styles.sectionLabel}>{children}</span>
        {action}
      </div>
    )
  }
  return <div className={styles.sectionLabel}>{children}</div>
}
