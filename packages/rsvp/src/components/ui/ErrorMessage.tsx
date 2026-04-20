import styles from './ErrorMessage.module.css'

interface ErrorMessageProps {
  children: string | null | undefined
  // `inline` tightens the top margin so the message sits close to an input
  // or action it's describing.
  variant?: 'default' | 'inline'
}

export function ErrorMessage({
  children,
  variant = 'default',
}: ErrorMessageProps) {
  if (!children) return null
  const cls = [styles.error, variant === 'inline' ? styles.inline : null]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} role="alert">
      <p>{children}</p>
    </div>
  )
}
