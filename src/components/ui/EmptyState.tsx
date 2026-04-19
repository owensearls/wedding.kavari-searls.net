import styles from './EmptyState.module.css'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  children: ReactNode
}

function EmptyState({ children }: EmptyStateProps) {
  return <div className={styles.empty}>{children}</div>
}

export default EmptyState
