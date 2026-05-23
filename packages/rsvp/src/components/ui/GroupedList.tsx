import styles from './GroupedList.module.css'
import type { CSSProperties, ReactNode } from 'react'

interface GroupedListProps {
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function GroupedList({
  ariaLabel,
  className,
  style,
  children,
}: GroupedListProps) {
  return (
    <div className={styles.wrap}>
      <div
        className={[styles.list, className].filter(Boolean).join(' ')}
        role="table"
        aria-label={ariaLabel}
        style={style}
      >
        {children}
      </div>
    </div>
  )
}

interface GroupedListHeaderRowProps {
  children: ReactNode
}

export function GroupedListHeaderRow({ children }: GroupedListHeaderRowProps) {
  return (
    <div className={styles.headerRow} role="row">
      {children}
    </div>
  )
}

interface GroupedListHeaderCellProps {
  // Renders the right-aligned, right-bordered variant used over the gutter
  // column. Visually mirrors the gutter and separates it from data columns.
  gutter?: boolean
  className?: string
  children: ReactNode
}

export function GroupedListHeaderCell({
  gutter,
  className,
  children,
}: GroupedListHeaderCellProps) {
  return (
    <div
      role="columnheader"
      className={[
        styles.headerCell,
        gutter ? styles.headerGutter : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}

interface GroupedListBlockProps {
  solo?: boolean
  rowSpan: number
  gutter: ReactNode
  ariaHidden?: boolean
  children: ReactNode
}

export function GroupedListBlock({
  solo = false,
  rowSpan,
  gutter,
  ariaHidden,
  children,
}: GroupedListBlockProps) {
  return (
    <div
      className={`${styles.block} ${solo ? styles.blockSolo : styles.blockMulti}`}
      role="rowgroup"
      aria-hidden={ariaHidden}
    >
      <div className={styles.gutter} style={{ gridRow: `1 / span ${rowSpan}` }}>
        {gutter}
      </div>
      {children}
    </div>
  )
}

interface GroupedListEmptyBlockProps {
  children: ReactNode
}

export function GroupedListEmptyBlock({
  children,
}: GroupedListEmptyBlockProps) {
  return (
    <div className={styles.emptyBlock}>
      <div className={styles.emptyCell}>{children}</div>
    </div>
  )
}
