'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingIndicator } from '../components/ui/LoadingIndicator'
import { getRsvpGroup, submitRsvp } from '../server/rsvp'
import { GuestResponseCard } from './GuestResponseCard'
import {
  buildInitialRsvpFormValues,
  rsvpFormSchema,
  type EventDraftForm,
  type RsvpFormValues,
} from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type {
  GuestResponseSubmission,
  RsvpGroupResponse,
  RsvpSubmission,
} from '../schema'

// Untouched optional notes fields come through the form as `undefined`.
// Drop them so the wire payload is a clean Record<string, string | null>.
function stripUndefinedNotes(
  notes: Record<string, string | null | undefined>
): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(notes)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

export function RsvpFull() {
  const [code, setCode] = useState<string | null>(null)
  const [data, setData] = useState<RsvpGroupResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpFormSchema),
    // Mode 'onSubmit' (the default) defers validation until the user tries
    // to submit; once we've shown errors react-hook-form auto-revalidates
    // on change so they clear as the user fills things in.
    defaultValues: { drafts: [] },
  })
  const { control, handleSubmit, reset, formState } = form
  const { fields } = useFieldArray({ control, name: 'drafts' })

  useEffect(() => {
    setCode(new URLSearchParams(window.location.search).get('code'))
  }, [])

  useEffect(() => {
    if (code === null) return
    if (code === '') {
      setLoading(false)
      setLoadError('Missing invite code.')
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getRsvpGroup(code)
      .then((res) => {
        if (cancelled) return
        setData(res)
        reset(buildInitialRsvpFormValues(res))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, reset])

  const guestById = useMemo(() => {
    if (!data) return new Map()
    return new Map(data.guests.map((g) => [g.id, g]))
  }, [data])

  async function onValid(values: RsvpFormValues) {
    if (!data || !code) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const guestResponses: GuestResponseSubmission[] = values.drafts
        .filter((d) => d.respondingFor)
        .map((d) => ({
          guestId: d.guestId,
          notesJson: stripUndefinedNotes(d.notesJson),
          events: d.events
            // After validation, statuses on responding-for guests are
            // either 'attending' or 'declined' — never ''. Filter
            // defensively so the type narrows.
            .filter(
              (e): e is EventDraftForm & { status: 'attending' | 'declined' } =>
                e.status !== ''
            )
            .map((e) => ({
              eventId: e.eventId,
              status: e.status,
              notesJson: stripUndefinedNotes(e.notesJson),
            })),
        }))
      const submission: RsvpSubmission = {
        respondedByGuestId: data.actingGuestId,
        guestResponses,
      }
      await submitRsvp(code, submission)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  function onInvalid() {
    setSubmitError(
      'Pick attending or can\'t make it for each event — or turn off "Respond for…" on guests you don\'t want to answer for.'
    )
  }

  const actingGuestIndex = data
    ? fields.findIndex((f) => f.guestId === data.actingGuestId)
    : -1
  const otherGuestIndexes = fields
    .map((_, i) => i)
    .filter((i) => i !== actingGuestIndex)
  const hasDeadline = data?.events.some((e) => e.rsvpDeadline) ?? false

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <a href="/" className={styles.backLink}>
          ← Back to home
        </a>

        {loading && <LoadingIndicator label="Loading your invitation…" />}
        {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

        {data && submitted && (
          <div className={styles.success}>
            <h2 className={styles.successHeading}>Thank you!</h2>
            <p className={styles.successCopy}>
              Your response has been recorded. You may return to this page{' '}
              {hasDeadline
                ? 'any time before the deadline'
                : 'at any time before the wedding'}{' '}
              to revise it.
            </p>
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setSubmitted(false)}
            >
              Edit RSVP
            </button>
          </div>
        )}

        {data && !submitted && actingGuestIndex >= 0 && (
          <form onSubmit={handleSubmit(onValid, onInvalid)} noValidate>
            <h1 className={styles.heading}>RSVP</h1>
            {data.group.label && (
              <div className={styles.subheading}>{data.group.label}</div>
            )}

            {data.events.length === 0 ? (
              <p className={styles.empty}>
                No events are open for RSVP yet — please check back soon.
              </p>
            ) : (
              <>
                <GuestResponseCard
                  guestName={
                    guestById.get(data.actingGuestId)?.displayName ?? ''
                  }
                  events={data.events}
                  invitationNotesSchema={data.invitationNotesSchema}
                  showRespondingToggle={false}
                  control={control}
                  draftIndex={actingGuestIndex}
                  errors={formState.errors.drafts?.[actingGuestIndex]}
                />

                {otherGuestIndexes.length > 0 && (
                  <>
                    <div className={styles.sectionDivider}>
                      <span className={styles.dividerLine} aria-hidden="true" />
                      <span className={styles.dividerLabel}>
                        Responding for anyone else?
                      </span>
                      <span className={styles.dividerLine} aria-hidden="true" />
                    </div>
                    {otherGuestIndexes.map((i) => {
                      const guestId = fields[i].guestId
                      const g = guestById.get(guestId)
                      return (
                        <GuestResponseCard
                          key={fields[i].id}
                          guestName={g?.displayName ?? ''}
                          guestFirstName={g?.firstName}
                          events={data.events}
                          invitationNotesSchema={data.invitationNotesSchema}
                          showRespondingToggle
                          control={control}
                          draftIndex={i}
                          errors={formState.errors.drafts?.[i]}
                        />
                      )
                    })}
                  </>
                )}
              </>
            )}

            {data.events.length > 0 && (
              <>
                <div className={styles.submitRow}>
                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={submitting}
                  >
                    {submitting ? 'Saving…' : 'Save response'}
                  </button>
                </div>
                <ErrorMessage>{submitError}</ErrorMessage>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
