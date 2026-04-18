import type { CSSProperties, ReactNode } from 'react'
import styles from './FieldGroup.module.css'

interface FieldGroupProps {
  label: string
  hint?: string
  children: ReactNode
  style?: CSSProperties
}

function FieldGroup({ label, hint, children, style }: FieldGroupProps) {
  return (
    <div className={styles.fieldGroup} style={style}>
      <label className={styles.label}>
        {label}
        {hint && <> <span className={styles.hint}>({hint})</span></>}
      </label>
      {children}
    </div>
  )
}

export default FieldGroup
