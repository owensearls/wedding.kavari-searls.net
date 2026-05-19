'use client'

import {
  fieldsInOrder,
  isShortTextField,
  isSingleSelectField,
  type NotesFieldSchema,
  type NotesJsonSchema,
} from 'db'
import styles from './GuestResponseCard.module.css'
import { formatRsvpDate, type GuestResponseDraft } from './rsvpFormState'
import type { EventDetails, RsvpStatus } from '../schema'

interface GuestResponseCardProps {
  guestName: string
  draft: GuestResponseDraft
  events: EventDetails[]
  invitationNotesSchema: NotesJsonSchema | null
  // When true, render the toggle at the top right of the card. The acting
  // guest never sees this toggle (they're always responding for themselves).
  showRespondingToggle: boolean
  onEventStatusChange: (eventId: string, status: RsvpStatus | null) => void
  onEventNoteChange: (eventId: string, fieldKey: string, value: string) => void
  onInviteNoteChange: (fieldKey: string, value: string) => void
  onRespondingForChange: (next: boolean) => void
}

export function GuestResponseCard({
  guestName,
  draft,
  events,
  invitationNotesSchema,
  showRespondingToggle,
  onEventStatusChange,
  onEventNoteChange,
  onInviteNoteChange,
  onRespondingForChange,
}: GuestResponseCardProps) {
  const eventByEventId = new Map(draft.events.map((e) => [e.eventId, e]))
  const inviteFields = invitationNotesSchema
    ? fieldsInOrder(invitationNotesSchema)
    : []

  const isCollapsed = showRespondingToggle && !draft.respondingFor

  return (
    <article
      className={`${styles.card} ${isCollapsed ? styles.cardCollapsed : ''}`}
    >
      <header className={styles.header}>
        <h2 className={styles.name}>{guestName}</h2>
        {showRespondingToggle && (
          <RespondingForToggle
            checked={draft.respondingFor}
            onChange={onRespondingForChange}
          />
        )}
      </header>

      {!isCollapsed && (
        <>
          <ul className={styles.events}>
            {events.map((event) => (
              <li key={event.id} className={styles.event}>
                <div className={styles.eventHead}>
                  <div className={styles.eventTitleBlock}>
                    <span className={styles.eventName}>{event.name}</span>
                    {(formatRsvpDate(event.startsAt) || event.locationName) && (
                      <span className={styles.eventMeta}>
                        {[formatRsvpDate(event.startsAt), event.locationName]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                  <StatusToggle
                    value={eventByEventId.get(event.id)?.status ?? null}
                    onChange={(next) => onEventStatusChange(event.id, next)}
                  />
                </div>
                {event.notesSchema && (
                  <EventNotesGrid
                    schema={event.notesSchema}
                    values={eventByEventId.get(event.id)?.notesJson ?? {}}
                    onChange={(k, v) => onEventNoteChange(event.id, k, v)}
                  />
                )}
              </li>
            ))}
          </ul>

          {inviteFields.length > 0 && (
            <>
              <div className={styles.flourish} aria-hidden="true">
                ❦
              </div>
              <div className={styles.inviteFields}>
                {inviteFields.map(({ key, field }) => (
                  <NoteField
                    key={key}
                    field={field}
                    value={draft.notesJson[key] ?? ''}
                    onChange={(next) => onInviteNoteChange(key, next)}
                    id={`g-${draft.guestId}-${key}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </article>
  )
}

function RespondingForToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className={styles.respondingFor}>
      <span className={styles.respondingForLabel}>
        {checked ? 'Responding for them' : 'Not responding'}
      </span>
      <span
        className={`${styles.toggleTrack} ${checked ? styles.toggleTrackOn : ''}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={styles.toggleInput}
          aria-label="Responding for this guest"
        />
        <span className={styles.toggleThumb} />
      </span>
    </label>
  )
}

function StatusToggle({
  value,
  onChange,
}: {
  value: RsvpStatus | null
  onChange: (next: RsvpStatus | null) => void
}) {
  return (
    <div className={styles.toggleGroup} role="group" aria-label="RSVP status">
      <button
        type="button"
        className={`${styles.toggleButton} ${value === 'attending' ? styles.toggleButtonActive : ''}`}
        onClick={() => onChange(value === 'attending' ? null : 'attending')}
      >
        Attending
      </button>
      <button
        type="button"
        className={`${styles.toggleButton} ${value === 'declined' ? styles.toggleButtonActive : ''}`}
        onClick={() => onChange(value === 'declined' ? null : 'declined')}
      >
        Can't make it
      </button>
    </div>
  )
}

function EventNotesGrid({
  schema,
  values,
  onChange,
}: {
  schema: NotesJsonSchema
  values: Record<string, string | null>
  onChange: (key: string, value: string) => void
}) {
  const fields = fieldsInOrder(schema)
  if (fields.length === 0) return null
  return (
    <div className={styles.eventFields}>
      {fields.map(({ key, field }) => (
        <NoteField
          key={key}
          field={field}
          value={values[key] ?? ''}
          onChange={(next) => onChange(key, next)}
          id={`evt-${key}`}
          variant="inline"
        />
      ))}
    </div>
  )
}

function NoteField({
  field,
  value,
  onChange,
  id,
  variant,
}: {
  field: NotesFieldSchema
  value: string
  onChange: (next: string) => void
  id: string
  variant?: 'inline'
}) {
  return (
    <div
      className={
        variant === 'inline' ? styles.fieldInline : styles.fieldStacked
      }
    >
      <label htmlFor={id} className={styles.fieldLabel}>
        {field.title}
      </label>
      {isSingleSelectField(field) ? (
        <select
          id={id}
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {field.oneOf.map((opt) => (
            <option key={opt.const} value={opt.const}>
              {opt.title}
            </option>
          ))}
        </select>
      ) : isShortTextField(field) ? (
        <input
          id={id}
          type="text"
          className={styles.input}
          maxLength={field.maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}
