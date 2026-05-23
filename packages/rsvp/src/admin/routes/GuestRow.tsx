import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import styles from './GuestList.module.css'
import type { AdminGroupListGuest } from '../../schema'
import type { AdminEventRecord } from '../../server/admin/events'

type GuestRowProps =
  | {
      loading: true
    }
  | {
      loading?: false
      eventColumns: AdminEventRecord[]
      guest: AdminGroupListGuest
      onClick: () => void
    }

export function GuestRow(props: GuestRowProps) {
  if (props.loading) {
    return (
      <div
        role="row"
        className={`${styles.guestRow} ${styles.guestRowStatic}`}
        aria-hidden="true"
      >
        <div className={styles.loadingRowCell}>
          <div className={styles.loadingBar} />
        </div>
      </div>
    )
  }

  const { guest, eventColumns, onClick } = props
  return (
    <div role="row" className={styles.guestRow} onClick={onClick}>
      <div role="cell" className={styles.nameCell}>
        <span className={styles.nameText}>{guest.displayName}</span>
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
      <div className={styles.eventsRowCell}>
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
    </div>
  )
}
