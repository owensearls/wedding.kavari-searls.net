import styles from './LoadingIndicator.module.css'

interface LoadingIndicatorProps {
  label?: string
  // Use `inline` when you need a smaller vertical footprint — for instance,
  // inside a modal or a narrow card.
  variant?: 'default' | 'inline'
}

export function LoadingIndicator({
  label = 'Loading…',
  variant = 'default',
}: LoadingIndicatorProps) {
  const cls = [styles.wrap, variant === 'inline' ? styles.inline : null]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
    </div>
  )
}
