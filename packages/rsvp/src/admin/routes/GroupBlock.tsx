import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import styles from './GuestList.module.css'
import type { AdminGroupListItem } from '../../schema'
import type { AdminEventRecord } from '../../server/admin/events'

interface GroupBlockProps {
  group: AdminGroupListItem
  eventColumns: AdminEventRecord[]
  onEdit: () => void
  onOpenGuest: (guestId: string) => void
}

export function GroupBlock({
  group,
  eventColumns,
  onEdit,
  onOpenGuest,
}: GroupBlockProps) {
  const isSolo = group.guestCount <= 1
  const rowSpan = Math.max(group.guests.length, 1)

  return (
    <div
      className={`${styles.block} ${isSolo ? styles.blockSolo : styles.blockMulti}`}
      role="rowgroup"
    >
      <div className={styles.gutter} style={{ gridRow: `1 / span ${rowSpan}` }}>
        <button
          type="button"
          className={styles.gutterEdit}
          onClick={onEdit}
          title="Edit invite"
          aria-label={`Edit ${group.label}`}
        >
          <span className={styles.gutterName}>{group.label}</span>
          <span className={styles.gutterMeta}>
            {isSolo ? 'solo' : `${group.guestCount} guests`}
          </span>
          {!isSolo && (
            <span className={styles.gutterStats}>
              <span className={styles.tally}>
                <span className={`${styles.tallyDot} ${styles.dotAttending}`} />
                <span className={styles.tallyNum}>{group.attendingCount}</span>
              </span>
              <span className={styles.tally}>
                <span className={`${styles.tallyDot} ${styles.dotDeclined}`} />
                <span className={styles.tallyNum}>{group.declinedCount}</span>
              </span>
              <span className={styles.tally}>
                <span className={`${styles.tallyDot} ${styles.dotPending}`} />
                <span className={styles.tallyNum}>{group.pendingCount}</span>
              </span>
            </span>
          )}
          <span className={styles.gutterEditIcon} aria-hidden="true">
            ✎
          </span>
        </button>
      </div>
      {group.guests.map((guest) => (
        <div
          key={guest.id}
          role="row"
          className={styles.guestRow}
          onClick={() => onOpenGuest(guest.id)}
        >
          <div role="cell" className={styles.nameCell}>
            {guest.displayName}
          </div>
          <div role="cell">
            <a
              href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp?code=${encodeURIComponent(guest.inviteCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={styles.codeLink}
            >
              {guest.inviteCode}
            </a>
          </div>
          {eventColumns.map((ev) => {
            const s = guest.eventStatuses.find((es) => es.eventId === ev.id)
            return (
              <div
                key={ev.id}
                role="cell"
                className={`${styles.statusCell} ${statusClassName(s?.status)}`}
              >
                <StatusBadge status={s?.status} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
