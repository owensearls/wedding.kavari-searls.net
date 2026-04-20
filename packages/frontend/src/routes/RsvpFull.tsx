import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRsvpGroup, submitRsvp } from 'rsvp/api/public'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingIndicator } from '../components/ui/LoadingIndicator'
import {
  buildInitialRsvpFormState,
  rsvpKey,
  type RsvpFormState,
} from '../lib/rsvpFormState'
import { EventCardEditor } from './EventCardEditor'
import styles from './RsvpFull.module.css'
import type {
  Guest,
  RsvpGroupResponse,
  RsvpStatus,
  RsvpSubmission,
} from '@shared/schemas/rsvp'

export function RsvpFull() {
  const { code = '' } = useParams<{ code: string }>()
  const [data, setData] = useState<RsvpGroupResponse | null>(null)
  const [state, setState] = useState<RsvpFormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
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
      const current = s.rsvps[k] ?? { status: 'pending', mealChoiceId: null }
      return {
        ...s,
        rsvps: {
          ...s.rsvps,
          [k]: {
            ...current,
            status,
            mealChoiceId: status === 'attending' ? current.mealChoiceId : null,
          },
        },
      }
    })
  }

  function setMeal(guestId: string, eventId: string, mealChoiceId: string) {
    setState((s) => {
      if (!s) return s
      const k = rsvpKey(guestId, eventId)
      const current = s.rsvps[k] ?? { status: 'attending', mealChoiceId: null }
      return {
        ...s,
        rsvps: {
          ...s.rsvps,
          [k]: { ...current, mealChoiceId: mealChoiceId || null },
        },
      }
    })
  }

  function setDietary(guestId: string, value: string) {
    setState((s) =>
      s ? { ...s, dietary: { ...s.dietary, [guestId]: value } } : s
    )
  }

  function setSong(guestId: string, field: 'title' | 'artist', value: string) {
    setState((s) =>
      s
        ? {
            ...s,
            songs: {
              ...s.songs,
              [guestId]: {
                ...(s.songs[guestId] ?? { title: '', artist: '' }),
                [field]: value,
              },
            },
          }
        : s
    )
  }

  function setNotes(guestId: string, value: string) {
    setState((s) => (s ? { ...s, notes: { ...s.notes, [guestId]: value } } : s))
  }

  async function onSubmit() {
    if (!state || !data) return
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
            mealChoiceId: v.mealChoiceId,
          }
        }),
        guestUpdates: data.guests.map((g) => {
          const songTitle = state.songs[g.id]?.title?.trim()
          const songArtist = state.songs[g.id]?.artist?.trim()
          const notesJson = songTitle
            ? {
                songRequest: {
                  title: songTitle,
                  artist: songArtist || null,
                },
              }
            : null
          return {
            guestId: g.id,
            dietaryRestrictions: state.dietary[g.id]?.trim() || null,
            notes: state.notes[g.id]?.trim() || null,
            notesJson,
          }
        }),
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

  const primaryGuestId = data?.guests[0]?.id

  return (
    <div className={`${styles.page} ${styles.background}`}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← Back to home
        </Link>

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
                onMealChange={setMeal}
              />
            ))}

            <div className={styles.detailsCard}>
              <h2 className={styles.detailsHeading}>Other details</h2>
              {data.guests.map((g) => (
                <div key={g.id}>
                  <label className={styles.fieldLabel}>
                    {g.displayName} — Dietary restrictions or allergies
                  </label>
                  <input
                    type="text"
                    className={styles.select}
                    value={state.dietary[g.id] ?? ''}
                    onChange={(e) => setDietary(g.id, e.target.value)}
                  />
                </div>
              ))}

              {primaryGuestId && (
                <>
                  <label className={styles.fieldLabel}>
                    Song request (optional)
                  </label>
                  <input
                    type="text"
                    className={styles.select}
                    placeholder="Song title"
                    value={state.songs[primaryGuestId]?.title ?? ''}
                    onChange={(e) =>
                      setSong(primaryGuestId, 'title', e.target.value)
                    }
                  />
                  <input
                    type="text"
                    className={styles.select}
                    placeholder="Artist (optional)"
                    style={{ marginTop: 8 }}
                    value={state.songs[primaryGuestId]?.artist ?? ''}
                    onChange={(e) =>
                      setSong(primaryGuestId, 'artist', e.target.value)
                    }
                  />

                  <label className={styles.fieldLabel}>
                    Anything else we should know?
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={state.notes[primaryGuestId] ?? ''}
                    onChange={(e) => setNotes(primaryGuestId, e.target.value)}
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
                {submitting ? 'Sending…' : 'Send RSVP'}
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
            <Link to="/" className={styles.backLink}>
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
