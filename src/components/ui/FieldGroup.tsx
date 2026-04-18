import type { CSSProperties, ReactNode } from 'react'
import styles from './FieldGroup.module.css'

interface FieldGroupProps {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  style?: CSSProperties
}

function FieldGroup({ label, hint, error, children, style }: FieldGroupProps) {
  return (
    <div className={styles.fieldGroup} style={style}>
      <label className={styles.label}>
        {label}
        {hint && <> <span className={styles.hint}>({hint})</span></>}
      </label>
      {children}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  )
}

export default FieldGroup
