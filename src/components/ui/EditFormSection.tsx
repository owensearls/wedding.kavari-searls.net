import type { ReactNode } from 'react'
import styles from './EditFormShell.module.css'

interface EditFormSectionProps {
  children: ReactNode
}

// A single section inside an EditFormShell — wraps its children in the
// bordered card style that stacks below the form header.
function EditFormSection({ children }: EditFormSectionProps) {
  return <div className={styles.section}>{children}</div>
}

export default EditFormSection
