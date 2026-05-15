import styles from './StatusBadge.module.css'

export type StatusValue = 'pending' | 'attending' | 'declined' | 'not-invited'

export const DEFAULT_STATUS_LABELS: Record<StatusValue, string> = {
  attending: 'Attending',
  declined: 'Declined',
  pending: 'Pending',
  'not-invited': '—',
}

// Returns the color-class for a given RSVP status — use to paint a container
// element (like a table cell) that should pick up the status color.
export function statusClassName(status: StatusValue | undefined): string {
  switch (status) {
    case 'attending':
      return styles.attending
    case 'declined':
      return styles.declined
    case 'pending':
      return styles.pending
    case 'not-invited':
    case undefined:
      return styles.notInvited
  }
}
