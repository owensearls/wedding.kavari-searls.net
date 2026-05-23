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

interface TableSkeletonRowsProps {
  // Number of columns the placeholder bar should span. The bar itself is a
  // single full-width element — we only need this so the table layout stays
  // stable while loading.
  colSpan: number
  // How many placeholder rows to render. Defaults to 3.
  rows?: number
}

// Renders N empty rows with a single thin skeleton bar (text-height) spanning
// the full table width. Drop this inside <tbody> while data is loading so the
// header + table chrome stay statically rendered.
export function TableSkeletonRows({
  colSpan,
  rows = 3,
}: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className={styles.skeletonRow}>
          <td colSpan={colSpan}>
            <div className={styles.skeletonBar} />
          </td>
        </tr>
      ))}
    </>
  )
}

interface TableEmptyRowProps {
  colSpan: number
  children: ReactNode
}

// A single full-width row used to show a "no data" message inside the table
// (rather than replacing the table with an out-of-band empty state).
export function TableEmptyRow({ colSpan, children }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.emptyCell}>
        {children}
      </td>
    </tr>
  )
}
