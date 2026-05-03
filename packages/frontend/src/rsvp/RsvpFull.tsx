'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingIndicator } from '../components/ui/LoadingIndicator'
import { getRsvpGroup, submitRsvp } from '../server/rsvp'
import { EventCardEditor } from './EventCardEditor'
import {
  buildInitialRsvpFormState,
  rsvpKey,
  type RsvpFormState,
} from './rsvpFormState'
import styles from './RsvpFull.module.css'
import type {
  CustomFieldConfig,
  Guest,
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
    const m = new Map<string, Guest>()
    if (data) for (const g of data.guests) m.set(g.id, g)
    return m
  }, [data])

  function setStatus(guestId: string, eventId: string, status: RsvpStatus) {
    setState((s) => {
      if (!s) return s
      const k = rsvpKey(guestId, eventId)
      const current = s.rsvps[k] ?? { status: 'pending', notesJson: {} }
      const nextNotes = status === 'attending' ? current.notesJson : {}
      return {
        ...s,
        rsvps: { ...s.rsvps, [k]: { status, notesJson: nextNotes } },
      }
    })
  }

  function setCustom(
    guestId: string,
    eventId: string,
    fieldKey: string,
    value: string
  ) {
    setState((s) => {
      if (!s) return s
      const k = rsvpKey(guestId, eventId)
      const current = s.rsvps[k] ?? { status: 'pending', notesJson: {} }
      const nextNotes = { ...current.notesJson, [fieldKey]: value || null }
      return {
        ...s,
        rsvps: { ...s.rsvps, [k]: { ...current, notesJson: nextNotes } },
      }
    })
  }

  function setGuestCustom(guestId: string, fieldKey: string, value: string) {
    setState((s) =>
      s
        ? {
            ...s,
            guestNotesJson: {
              ...s.guestNotesJson,
              [guestId]: {
                ...(s.guestNotesJson[guestId] ?? {}),
                [fieldKey]: value || null,
              },
            },
          }
        : s
    )
  }

  function setGuestNotes(guestId: string, value: string) {
    setState((s) =>
      s
        ? {
            ...s,
            guestNotes: { ...s.guestNotes, [guestId]: value },
          }
        : s
    )
  }

  async function onSubmit() {
    if (!state || !data || !code) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const submission: RsvpSubmission = {
        respondedByGuestId: state.respondedByGuestId || data.guests[0].id,
        rsvps: Object.entries(state.rsvps).map(([k, v]) => {
          const [guestId, eventId] = k.split('::')
          return {
            guestId,
            eventId,
            status: v.status,
            notesJson: v.notesJson,
          }
        }),
        guestUpdates: data.guests.map((g) => ({
          guestId: g.id,
          notes: state.guestNotes[g.id]?.trim() || null,
          notesJson: state.guestNotesJson[g.id] ?? {},
        })),
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

  const primaryGuestId = data?.guests[0]?.id
  const hasPriorRsvp =
    data?.rsvps.some((r) => r.respondedAt !== null) ?? false
  const showSaveLabel = hasPriorRsvp || savedThisSession

  function renderGuestCustomField(g: Guest, f: CustomFieldConfig) {
    const v = state?.guestNotesJson[g.id]?.[f.key]
    const value = typeof v === 'string' ? v : ''
    if (f.type === 'single_select') {
      return (
        <select
          className={styles.select}
          value={value}
          onChange={(e) => setGuestCustom(g.id, f.key, e.target.value)}
        >
          <option value="">Choose…</option>
          {f.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    return (
      <input
        type="text"
        className={styles.select}
        maxLength={500}
        value={value}
        onChange={(e) => setGuestCustom(g.id, f.key, e.target.value)}
      />
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <a href="/" className={styles.backLink}>
          ← Back to home
        </a>

        {loading && <LoadingIndicator label="Loading your invitation…" />}
        {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

        {data && state && !submitted && (
          <>
            <h1 className={styles.heading}>RSVP</h1>
            <div className={styles.subheading}>{data.group.label}</div>

            {data.events.length === 0 && (
              <p className={styles.centered}>
                No events are open for RSVP yet — check back soon.
              </p>
            )}

            {data.events.map((ev) => (
              <EventCardEditor
                key={ev.id}
                event={ev}
                guestById={guestById}
                state={state}
                singleGuest={data.guests.length === 1}
                onStatusChange={setStatus}
                onCustomChange={setCustom}
              />
            ))}

            <div className={styles.detailsCard}>
              <h2 className={styles.detailsHeading}>Other details</h2>
              {data.guests.map((g) => (
                <div key={g.id}>
                  {data.guestCustomFields.map((f) => (
                    <div key={f.id}>
                      <label className={styles.fieldLabel}>
                        {data.guests.length > 1
                          ? `${g.displayName} — ${f.label}`
                          : f.label}
                      </label>
                      {renderGuestCustomField(g, f)}
                    </div>
                  ))}
                </div>
              ))}

              {primaryGuestId && (
                <>
                  <label className={styles.fieldLabel}>
                    Anything else we should know?
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={state.guestNotes[primaryGuestId] ?? ''}
                    onChange={(e) =>
                      setGuestNotes(primaryGuestId, e.target.value)
                    }
                  />
                </>
              )}
            </div>

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
                    ? 'Save RSVP'
                    : 'Send RSVP'}
              </button>
            </div>
            <ErrorMessage>{submitError}</ErrorMessage>
          </>
        )}

        {submitted && (
          <div className={styles.success}>
            <h1>Thank you!</h1>
            <p>
              We've recorded your RSVP. You can return to this page any time
              before the deadline to change it.
            </p>
            <button type="button" onClick={() => setSubmitted(false)}>
              Edit RSVP
            </button>
            <a href="/" className={styles.backLink}>
              ← Back to home
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
