'use client'

import {
  fieldsInOrder,
  isShortTextField,
  isSingleSelectField,
  type NotesFieldSchema,
  type NotesJsonSchema,
} from 'db'
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
} from 'react-hook-form'
import styles from './GuestResponseCard.module.css'
import { formatRsvpDate, type RsvpFormValues } from './rsvpFormState'
import type { EventDetails, RsvpStatus } from '../schema'

interface GuestResponseCardProps {
  guestName: string
  // Used in the "Respond for <First Name>" toggle label on non-acting
  // guests' cards. Falls back to `guestName` when omitted.
  guestFirstName?: string
  events: EventDetails[]
  invitationNotesSchema: NotesJsonSchema | null
  // When true, render the toggle at the top right of the card. The acting
  // guest never sees this toggle (they're always responding for themselves).
  showRespondingToggle: boolean
  control: Control<RsvpFormValues>
  // Index of this guest's draft in the form's `drafts` field array.
  draftIndex: number
  errors: FieldErrors<RsvpFormValues['drafts'][number]> | undefined
}

export function GuestResponseCard({
  guestName,
  guestFirstName,
  events,
  invitationNotesSchema,
  showRespondingToggle,
  control,
  draftIndex,
  errors,
}: GuestResponseCardProps) {
  const respondingFor = useWatch({
    control,
    name: `drafts.${draftIndex}.respondingFor`,
  })
  const guestId = useWatch({
    control,
    name: `drafts.${draftIndex}.guestId`,
  })
  const inviteFields = invitationNotesSchema
    ? fieldsInOrder(invitationNotesSchema)
    : []
  const isCollapsed = showRespondingToggle && !respondingFor

  return (
    <article
      className={`${styles.card} ${isCollapsed ? styles.cardCollapsed : ''}`}
    >
      <header className={styles.header}>
        <h2 className={styles.name}>{guestName}</h2>
        {showRespondingToggle && (
          <Controller
            control={control}
            name={`drafts.${draftIndex}.respondingFor`}
            render={({ field }) => (
              <RespondingForToggle
                label={`Respond for ${guestFirstName || guestName}`}
                checked={!!field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}
      </header>

      {!isCollapsed && (
        <>
          <ul className={styles.events}>
            {events.map((event, eventIndex) => (
              <EventRow
                key={event.id}
                event={event}
                eventIndex={eventIndex}
                control={control}
                draftIndex={draftIndex}
                guestId={guestId}
                statusError={errors?.events?.[eventIndex]?.status?.message}
              />
            ))}
          </ul>

          {inviteFields.length > 0 && (
            <>
              <div className={styles.flourish} aria-hidden="true">
                ❦
              </div>
              <div className={styles.inviteFields}>
                {inviteFields.map(({ key, field }) => (
                  <Controller
                    key={key}
                    control={control}
                    name={`drafts.${draftIndex}.notesJson.${key}`}
                    render={({ field: rhf }) => (
                      <NoteField
                        field={field}
                        value={typeof rhf.value === 'string' ? rhf.value : ''}
                        onChange={(next) => rhf.onChange(next || null)}
                        id={`invite-${guestId}-${key}`}
                      />
                    )}
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

function EventRow({
  event,
  eventIndex,
  control,
  draftIndex,
  guestId,
  statusError,
}: {
  event: EventDetails
  eventIndex: number
  control: Control<RsvpFormValues>
  draftIndex: number
  guestId: string
  statusError: string | undefined
}) {
  const status = useWatch({
    control,
    name: `drafts.${draftIndex}.events.${eventIndex}.status`,
  })
  const showNotes = event.notesSchema !== null && status === 'attending'

  return (
    <li className={styles.event}>
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
        <Controller
          control={control}
          name={`drafts.${draftIndex}.events.${eventIndex}.status`}
          render={({ field }) => (
            <StatusToggle
              value={field.value || null}
              invalid={!!statusError}
              onChange={(next) => field.onChange(next ?? '')}
            />
          )}
        />
      </div>
      {statusError && (
        <div className={styles.statusError} role="alert">
          {statusError}
        </div>
      )}
      {showNotes && event.notesSchema && (
        <EventNotesGrid
          schema={event.notesSchema}
          control={control}
          draftIndex={draftIndex}
          eventIndex={eventIndex}
          idPrefix={`evt-${guestId}-${event.id}`}
        />
      )}
    </li>
  )
}

function RespondingForToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className={styles.respondingFor}>
      <span className={styles.respondingForLabel}>{label}</span>
      <span
        className={`${styles.toggleTrack} ${checked ? styles.toggleTrackOn : ''}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={styles.toggleInput}
          aria-label={label}
        />
        <span className={styles.toggleThumb} />
      </span>
    </label>
  )
}

function StatusToggle({
  value,
  invalid,
  onChange,
}: {
  value: RsvpStatus | null
  invalid: boolean
  onChange: (next: RsvpStatus | null) => void
}) {
  return (
    <div
      className={`${styles.toggleGroup} ${invalid ? styles.toggleGroupInvalid : ''}`}
      role="group"
      aria-label="RSVP status"
      aria-invalid={invalid || undefined}
    >
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
  control,
  draftIndex,
  eventIndex,
  idPrefix,
}: {
  schema: NotesJsonSchema
  control: Control<RsvpFormValues>
  draftIndex: number
  eventIndex: number
  idPrefix: string
}) {
  const fields = fieldsInOrder(schema)
  if (fields.length === 0) return null
  return (
    <div className={styles.eventFields}>
      {fields.map(({ key, field }) => (
        <Controller
          key={key}
          control={control}
          name={`drafts.${draftIndex}.events.${eventIndex}.notesJson.${key}`}
          render={({ field: rhf }) => (
            <NoteField
              field={field}
              value={typeof rhf.value === 'string' ? rhf.value : ''}
              onChange={(next) => rhf.onChange(next || null)}
              id={`${idPrefix}-${key}`}
              variant="inline"
            />
          )}
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
