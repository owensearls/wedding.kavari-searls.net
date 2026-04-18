import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  children: ReactNode
}

function EmptyState({ children }: EmptyStateProps) {
  return <div className={styles.empty}>{children}</div>
}

export default EmptyState
