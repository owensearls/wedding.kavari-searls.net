import { StatusTally } from '../../components/ui/StatusTally'
import { GuestRow } from './GuestRow'
import styles from './GuestList.module.css'
import type { AdminGroupListItem } from '../../schema'
import type { AdminEventRecord } from '../../server/admin/events'

type GroupBlockProps =
  | {
      loading: true
      rowCount: number
    }
  | {
      loading?: false
      group: AdminGroupListItem
      eventColumns: AdminEventRecord[]
      onEdit: () => void
      onOpenGuest: (guestId: string) => void
    }

export function GroupBlock(props: GroupBlockProps) {
  if (props.loading) {
    const { rowCount } = props
    const isSolo = rowCount === 1
    return (
      <div
        className={`${styles.block} ${isSolo ? styles.blockSolo : styles.blockMulti}`}
        role="rowgroup"
        aria-hidden="true"
      >
        <div
          className={styles.gutter}
          style={{ gridRow: `1 / span ${rowCount}` }}
        >
          <div className={`${styles.gutterEdit} ${styles.gutterEditStatic}`}>
            {!isSolo && (
              <>
                <div
                  className={`${styles.loadingBar} ${styles.loadingBarGroupName}`}
                />
                <div
                  className={`${styles.loadingBar} ${styles.loadingBarTally}`}
                />
              </>
            )}
            <div className={styles.gutterStats}>
              <div
                className={`${styles.loadingBar} ${styles.loadingBarTally}`}
              />
            </div>
          </div>
        </div>
        {Array.from({ length: rowCount }, (_, i) => (
          <GuestRow key={i} loading />
        ))}
      </div>
    )
  }

  const { group, eventColumns, onEdit, onOpenGuest } = props
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
          {!isSolo && (
            <>
              <span className={styles.gutterName}>{group.label}</span>
              <span
                className={styles.gutterMeta}
              >{`${group.guestCount} guests`}</span>
            </>
          )}
          <span className={styles.gutterStats}>
            <StatusTally
              attending={group.attendingCount}
              declined={group.declinedCount}
              pending={group.pendingCount}
            />
          </span>
          <span className={styles.gutterEditLabel} aria-hidden="true">
            Edit
          </span>
        </button>
      </div>
      {group.guests.map((guest) => (
        <GuestRow
          key={guest.id}
          guest={guest}
          eventColumns={eventColumns}
          onClick={() => onOpenGuest(guest.id)}
        />
      ))}
    </div>
  )
}
