import styles from './Table.module.css'
import type { ReactNode, TableHTMLAttributes } from 'react'

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode
}

// Wraps a native <table> in the shared overflow container + taupe card border.
// Callers still compose their own <thead>/<tbody> — we're not trying to be a
// data-grid, just standardizing the chrome.
export function Table({ children, className, ...rest }: TableProps) {
  return (
    <div className={styles.wrap}>
      <table
        {...rest}
        className={[styles.table, className].filter(Boolean).join(' ')}
      >
        {children}
      </table>
    </div>
  )
}
