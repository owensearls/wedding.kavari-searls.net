import styles from './StatusTally.module.css'

interface StatusTallyProps {
  attending: number
  declined: number
  pending: number
}

// Three color-coded dots with counts (attending/declined/pending). Used in
// the guest list gutter and the events table to give a quick visual
// breakdown of RSVP status.
export function StatusTally({
  attending,
  declined,
  pending,
}: StatusTallyProps) {
  return (
    <span className={styles.tallyGroup}>
      <span className={styles.tally}>
        <span className={`${styles.tallyDot} ${styles.dotAttending}`} />
        <span className={styles.tallyNum}>{attending}</span>
      </span>
      <span className={styles.tally}>
        <span className={`${styles.tallyDot} ${styles.dotDeclined}`} />
        <span className={styles.tallyNum}>{declined}</span>
      </span>
      <span className={styles.tally}>
        <span className={`${styles.tallyDot} ${styles.dotPending}`} />
        <span className={styles.tallyNum}>{pending}</span>
      </span>
    </span>
  )
}
