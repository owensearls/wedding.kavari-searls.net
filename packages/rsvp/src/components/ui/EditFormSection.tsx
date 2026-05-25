import styles from './EditFormShell.module.css'
import type { ReactNode } from 'react'

interface EditFormSectionProps {
  children: ReactNode
  className?: string
}

// A single section inside an EditFormShell — wraps its children in the
// bordered card style that stacks below the form header.
export function EditFormSection({ children, className }: EditFormSectionProps) {
  const classes = [styles.section, className].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}
