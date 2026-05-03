import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import styles from './GuestList.module.css'
import type { AdminGroupListItem } from '../../schema'
import type { AdminEventRecord } from '../../server/admin/events'

interface GroupBlockProps {
  group: AdminGroupListItem
  eventColumns: AdminEventRecord[]
  colCount: number
  onEdit: () => void
  onOpenGuest: (guestId: string) => void
}

export function GroupBlock({
  group,
  eventColumns,
  colCount,
  onEdit,
  onOpenGuest,
}: GroupBlockProps) {
  const showHeader = group.guestCount > 1
  return (
    <>
      {showHeader && (
        <tr className={styles.groupHeaderRow}>
          <td colSpan={colCount}>
            <div className={styles.groupHeaderContent}>
              <span className={styles.groupHeaderLabel}>{group.label}</span>
              <span className={styles.groupHeaderStats}>
                {group.guestCount} guests ·{' '}
                <StatusBadge
                  status="attending"
                  label={`${group.attendingCount} attending`}
                />{' '}
                ·{' '}
                <StatusBadge
                  status="declined"
                  label={`${group.declinedCount} declined`}
                />{' '}
                ·{' '}
                <StatusBadge
                  status="pending"
                  label={`${group.pendingCount} pending`}
                />
              </span>
            </div>
          </td>
        </tr>
      )}
      {group.guests.map((guest) => (
        <tr
          key={guest.id}
          className={styles.guestClickRow}
          onClick={() => onOpenGuest(guest.id)}
        >
          <td>{guest.displayName}</td>
          <td>
            <a
              href={`/rsvp/${encodeURIComponent(guest.inviteCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={styles.codeLink}
            >
              {guest.inviteCode}
            </a>
          </td>
          {eventColumns.map((ev) => {
            const s = guest.eventStatuses.find((es) => es.eventId === ev.id)
            return (
              <td key={ev.id} className={statusClassName(s?.status)}>
                <StatusBadge status={s?.status} />
                {s?.mealLabel ? (
                  <span className={styles.mealHint}> · {s.mealLabel}</span>
                ) : null}
              </td>
            )
          })}
          <td className={styles.notesCell}>
            {[guest.dietaryRestrictions, guest.notes]
              .filter(Boolean)
              .join(' · ')}
          </td>
          <td className={styles.editCell}>
            <button
              type="button"
              className={styles.editIcon}
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title="Edit invite"
            >
              ✎
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}
