'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingIndicator } from '../components/ui/LoadingIndicator'
import { getRsvpGroup, submitRsvp } from '../server/rsvp'
import { GuestResponseCard } from './GuestResponseCard'
import {
  buildInitialRsvpFormState,
  type GuestResponseDraft,
  type RsvpFormState,
} from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type {
  GuestResponseSubmission,
  RsvpGroupResponse,
  RsvpStatus,
  RsvpSubmission,
} from '../schema'

export function RsvpFull() {
  const [code, setCode] = useState<string | null>(null)
  const [data, setData] = useState<RsvpGroupResponse | null>(null)
  const [state, setState] = useState<RsvpFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [savedThisSession, setSavedThisSession] = useState(false)

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
        setState(buildInitialRsvpFormState(res))
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
  }, [code])

  const guestById = useMemo(() => {
    if (!data) return new Map()
    return new Map(data.guests.map((g) => [g.id, g]))
  }, [data])

  function updateDraft(
    guestId: string,
    updater: (draft: GuestResponseDraft) => GuestResponseDraft
  ) {
    setState((s) => {
      if (!s) return s
      const current = s.drafts[guestId]
      if (!current) return s
      return {
        ...s,
        drafts: { ...s.drafts, [guestId]: updater(current) },
      }
    })
  }

  function setEventStatus(
    guestId: string,
    eventId: string,
    status: RsvpStatus | null
  ) {
    updateDraft(guestId, (draft) => {
      const filtered = draft.events.filter((e) => e.eventId !== eventId)
      if (status === null) return { ...draft, events: filtered }
      const existing = draft.events.find((e) => e.eventId === eventId)
      return {
        ...draft,
        events: [
          ...filtered,
          {
            eventId,
            status,
            notesJson:
              status === 'attending' ? (existing?.notesJson ?? {}) : {},
          },
        ],
      }
    })
  }

  function setEventNote(
    guestId: string,
    eventId: string,
    key: string,
    value: string
  ) {
    updateDraft(guestId, (draft) => ({
      ...draft,
      events: draft.events.map((e) =>
        e.eventId === eventId
          ? {
              ...e,
              notesJson: { ...e.notesJson, [key]: value || null },
            }
          : e
      ),
    }))
  }

  function setInviteNote(guestId: string, key: string, value: string) {
    updateDraft(guestId, (draft) => ({
      ...draft,
      notesJson: { ...draft.notesJson, [key]: value || null },
    }))
  }

  function setRespondingFor(guestId: string, next: boolean) {
    updateDraft(guestId, (draft) => ({ ...draft, respondingFor: next }))
  }

  async function onSubmit() {
    if (!state || !data || !code) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const guestResponses: GuestResponseSubmission[] = state.guestOrder
        .map((id) => state.drafts[id])
        .filter((d) => d.respondingFor)
        .map((d) => ({
          guestId: d.guestId,
          notesJson: d.notesJson,
          events: d.events,
        }))
      const submission: RsvpSubmission = {
        respondedByGuestId: state.respondedByGuestId,
        guestResponses,
      }
      await submitRsvp(code, submission)
      setSavedThisSession(true)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const hasPriorResponse =
    data?.responses.some((r) => r.respondedAt !== null) ?? false
  const showSaveLabel = hasPriorResponse || savedThisSession

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <LoadingIndicator label="Loading your invitation…" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <a href="/" className={styles.backLink}>
            ← Back to home
          </a>
          <ErrorMessage>{loadError}</ErrorMessage>
        </div>
      </div>
    )
  }

  if (!data || !state) return null

  if (submitted) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <div className={styles.success}>
            <p className={styles.successOrnament} aria-hidden="true">
              ❦
            </p>
            <h1 className={styles.successHeading}>With gratitude</h1>
            <p className={styles.successCopy}>
              Your response has been recorded. You may return to this page any
              time before the deadline to revise it.
            </p>
            <div className={styles.successActions}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSubmitted(false)}
              >
                Edit response
              </button>
              <a href="/" className={styles.linkBtn}>
                Back to home
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const actingGuestId = state.guestOrder[0]
  const otherGuestIds = state.guestOrder.slice(1)

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <a href="/" className={styles.backLink}>
          ← Back to home
        </a>

        <header className={styles.pageHead}>
          <p className={styles.eyebrow}>Kindly respond</p>
          <h1 className={styles.heading}>RSVP</h1>
          {data.group.label && (
            <p className={styles.subheading}>{data.group.label}</p>
          )}
        </header>

        {data.events.length === 0 ? (
          <p className={styles.empty}>
            No events are open for RSVP yet — please check back soon.
          </p>
        ) : (
          <>
            <GuestResponseCard
              guestName={guestById.get(actingGuestId)?.displayName ?? ''}
              draft={state.drafts[actingGuestId]}
              events={data.events}
              invitationNotesSchema={data.invitationNotesSchema}
              showRespondingToggle={false}
              onEventStatusChange={(eventId, status) =>
                setEventStatus(actingGuestId, eventId, status)
              }
              onEventNoteChange={(eventId, key, value) =>
                setEventNote(actingGuestId, eventId, key, value)
              }
              onInviteNoteChange={(key, value) =>
                setInviteNote(actingGuestId, key, value)
              }
              onRespondingForChange={() => {}}
            />

            {otherGuestIds.length > 0 && (
              <>
                <div className={styles.sectionDivider}>
                  <span className={styles.dividerLine} aria-hidden="true" />
                  <span className={styles.dividerLabel}>
                    Responding for anyone else?
                  </span>
                  <span className={styles.dividerLine} aria-hidden="true" />
                </div>
                <p className={styles.dividerHint}>
                  Each guest defaults to "responding for them" — toggle off to
                  let them reply on their own.
                </p>
                {otherGuestIds.map((id) => (
                  <GuestResponseCard
                    key={id}
                    guestName={guestById.get(id)?.displayName ?? ''}
                    draft={state.drafts[id]}
                    events={data.events}
                    invitationNotesSchema={data.invitationNotesSchema}
                    showRespondingToggle
                    onEventStatusChange={(eventId, status) =>
                      setEventStatus(id, eventId, status)
                    }
                    onEventNoteChange={(eventId, key, value) =>
                      setEventNote(id, eventId, key, value)
                    }
                    onInviteNoteChange={(key, value) =>
                      setInviteNote(id, key, value)
                    }
                    onRespondingForChange={(next) => setRespondingFor(id, next)}
                  />
                ))}
              </>
            )}
          </>
        )}

        <div className={styles.submitRow}>
          <button
            type="button"
            className={styles.submit}
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting
              ? showSaveLabel
                ? 'Saving…'
                : 'Sending…'
              : showSaveLabel
                ? 'Save response'
                : 'Send response'}
          </button>
        </div>
        <ErrorMessage>{submitError}</ErrorMessage>
      </div>
    </div>
  )
}
