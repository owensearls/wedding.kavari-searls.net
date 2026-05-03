import { formatRsvpDate, rsvpKey, type RsvpFormState } from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type { EventDetails, Guest, RsvpStatus } from '../schema'

interface EventCardEditorProps {
  event: EventDetails
  guestById: Map<string, Guest>
  state: RsvpFormState
  singleGuest: boolean
  onStatusChange: (guestId: string, eventId: string, status: RsvpStatus) => void
  onMealChange: (guestId: string, eventId: string, mealChoiceId: string) => void
}

export function EventCardEditor({
  event,
  guestById,
  state,
  singleGuest,
  onStatusChange,
  onMealChange,
}: EventCardEditorProps) {
  const dateText = formatRsvpDate(event.startsAt)

  if (singleGuest) {
    const guestId = event.invitedGuestIds[0]
    const k = rsvpKey(guestId, event.id)
    const current = state.rsvps[k] ?? { status: 'pending', mealChoiceId: null }
    return (
      <div className={styles.eventCard}>
        <div className={styles.eventCardSingle}>
          <div>
            <h2 className={styles.eventName}>{event.name}</h2>
            {(dateText || event.locationName) && (
              <div className={styles.eventMeta}>
                {dateText}
                {dateText && event.locationName ? ' · ' : ''}
                {event.locationName}
              </div>
            )}
          </div>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggleButton} ${current.status === 'attending' ? styles.toggleButtonActive : ''}`}
              onClick={() => onStatusChange(guestId, event.id, 'attending')}
            >
              Attending
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${current.status === 'declined' ? styles.toggleButtonActive : ''}`}
              onClick={() => onStatusChange(guestId, event.id, 'declined')}
            >
              Can't make it
            </button>
          </div>
        </div>
        {event.requiresMealChoice &&
          current.status === 'attending' &&
          event.mealOptions.length > 0 && (
            <div className={styles.mealRow}>
              <label htmlFor={`meal-${k}`}>Meal:</label>
              <select
                id={`meal-${k}`}
                className={styles.select}
                value={current.mealChoiceId ?? ''}
                onChange={(e) =>
                  onMealChange(guestId, event.id, e.target.value)
                }
              >
                <option value="">Choose…</option>
                {event.mealOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
      </div>
    )
  }

  return (
    <div className={styles.eventCard}>
      <h2 className={styles.eventName}>{event.name}</h2>
      {(dateText || event.locationName) && (
        <div className={styles.eventMeta}>
          {dateText}
          {dateText && event.locationName ? ' · ' : ''}
          {event.locationName}
        </div>
      )}
      {event.invitedGuestIds.map((guestId) => {
        const g = guestById.get(guestId)
        if (!g) return null
        const k = rsvpKey(guestId, event.id)
        const current = state.rsvps[k] ?? {
          status: 'pending',
          mealChoiceId: null,
        }
        return (
          <div key={guestId} className={styles.guestRow}>
            <div className={styles.guestName}>{g.displayName}</div>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleButton} ${current.status === 'attending' ? styles.toggleButtonActive : ''}`}
                onClick={() => onStatusChange(guestId, event.id, 'attending')}
              >
                Attending
              </button>
              <button
                type="button"
                className={`${styles.toggleButton} ${current.status === 'declined' ? styles.toggleButtonActive : ''}`}
                onClick={() => onStatusChange(guestId, event.id, 'declined')}
              >
                Can't make it
              </button>
            </div>
            {event.requiresMealChoice &&
              current.status === 'attending' &&
              event.mealOptions.length > 0 && (
                <div className={styles.mealRow}>
                  <label htmlFor={`meal-${k}`}>Meal:</label>
                  <select
                    id={`meal-${k}`}
                    className={styles.select}
                    value={current.mealChoiceId ?? ''}
                    onChange={(e) =>
                      onMealChange(guestId, event.id, e.target.value)
                    }
                  >
                    <option value="">Choose…</option>
                    {event.mealOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
        )
      })}
    </div>
  )
}
