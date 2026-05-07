import { fieldsInOrder, isShortTextField, isSingleSelectField } from 'db'
import {
  defaultValueForField,
  formatRsvpDate,
  rsvpKey,
  type RsvpFormState,
} from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type { EventDetails, Guest, RsvpStatus } from '../schema'

interface EventCardEditorProps {
  event: EventDetails
  guestById: Map<string, Guest>
  state: RsvpFormState
  singleGuest: boolean
  onStatusChange: (guestId: string, eventId: string, status: RsvpStatus) => void
  onCustomChange: (
    guestId: string,
    eventId: string,
    fieldKey: string,
    value: string
  ) => void
}

export function EventCardEditor({
  event,
  guestById,
  state,
  singleGuest,
  onStatusChange,
  onCustomChange,
}: EventCardEditorProps) {
  const dateText = formatRsvpDate(event.startsAt)
  const fields = event.notesSchema ? fieldsInOrder(event.notesSchema) : []

  function renderToggleAndCustom(guestId: string) {
    const k = rsvpKey(guestId, event.id)
    const current = state.rsvps[k] ?? { status: 'pending', notesJson: {} }
    return (
      <>
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
        {current.status === 'attending' &&
          fields.map(({ key, field }) => (
            <div key={key} className={styles.mealRow}>
              <label htmlFor={`f-${k}-${key}`}>{field.title}:</label>
              {isSingleSelectField(field) ? (
                <select
                  id={`f-${k}-${key}`}
                  className={styles.select}
                  value={defaultValueForField(key, field, current.notesJson)}
                  onChange={(e) =>
                    onCustomChange(guestId, event.id, key, e.target.value)
                  }
                >
                  <option value="">Choose…</option>
                  {field.oneOf.map((opt) => (
                    <option key={opt.const} value={opt.const}>
                      {opt.title}
                    </option>
                  ))}
                </select>
              ) : isShortTextField(field) ? (
                <input
                  id={`f-${k}-${key}`}
                  type="text"
                  className={styles.select}
                  maxLength={field.maxLength}
                  value={defaultValueForField(key, field, current.notesJson)}
                  onChange={(e) =>
                    onCustomChange(guestId, event.id, key, e.target.value)
                  }
                />
              ) : null}
            </div>
          ))}
      </>
    )
  }

  if (singleGuest) {
    const guestId = event.invitedGuestIds[0]
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
          {renderToggleAndCustom(guestId)}
        </div>
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
        return (
          <div key={guestId} className={styles.guestRow}>
            <div className={styles.guestName}>{g.displayName}</div>
            {renderToggleAndCustom(guestId)}
          </div>
        )
      })}
    </div>
  )
}
