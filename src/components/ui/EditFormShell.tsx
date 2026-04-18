import type { ReactNode } from 'react'
import Button from './Button'
import styles from './EditFormShell.module.css'

interface EditFormShellProps {
  title: string
  onBack: () => void
  // The Back button text. Defaults to the "← Back to list" convention.
  backLabel?: string
  children: ReactNode
}

// Wraps an edit-style form page: a header with the title + back button, then
// the caller's sections / actions as children.
function EditFormShell({
  title,
  onBack,
  backLabel = '← Back to list',
  children,
}: EditFormShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
      </div>
      {children}
    </div>
  )
}

export default EditFormShell
