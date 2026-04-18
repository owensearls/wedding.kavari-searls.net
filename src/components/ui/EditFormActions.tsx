import type { ReactNode } from 'react'
import styles from './EditFormShell.module.css'

interface EditFormActionsProps {
  children: ReactNode
}

// Bottom action bar for an EditFormShell. Seats the primary + cancel buttons.
function EditFormActions({ children }: EditFormActionsProps) {
  return <div className={styles.actions}>{children}</div>
}

export default EditFormActions
