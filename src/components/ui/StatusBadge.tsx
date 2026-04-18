import styles from './StatusBadge.module.css'
import {
  DEFAULT_STATUS_LABELS,
  statusClassName,
  type StatusValue,
} from './statusHelpers'

interface StatusBadgeProps {
  status: StatusValue | undefined
  // Override the default label (e.g. "3 attending" on a summary row).
  label?: string
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const text = label ?? (status ? DEFAULT_STATUS_LABELS[status] : '—')
  return (
    <span className={`${styles.badge} ${statusClassName(status)}`}>
      {text}
    </span>
  )
}

export default StatusBadge
