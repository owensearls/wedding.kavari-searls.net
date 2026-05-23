import styles from './SectionLabel.module.css'
import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  // Render the label inline with trailing content (e.g., an "Add" button).
  // When true, children is the label text and `action` is the trailing content.
  action?: ReactNode
  className?: string
}

export function SectionLabel({
  children,
  action,
  className,
}: SectionLabelProps) {
  const labelClass = [styles.sectionLabel, className].filter(Boolean).join(' ')
  if (action) {
    return (
      <div className={styles.row}>
        <span className={labelClass}>{children}</span>
        {action}
      </div>
    )
  }
  return <div className={labelClass}>{children}</div>
}
