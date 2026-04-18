import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { rsvpGroupGet, rsvpGroupSubmit } from '../lib/api'
import type {
  EventDetails,
  Guest,
  RsvpGroupResponse,
  RsvpStatus,
  RsvpSubmission,
} from '@shared/schemas/rsvp'
import styles from './RsvpFull.module.css'

type RsvpKey = `${string}::${string}` // guestId::eventId

type FormState = {
  rsvps: Record<RsvpKey, { status: RsvpStatus; mealChoiceId: string | null }>
  dietary: Record<string, string>
  notes: Record<string, string>
  songs: Record<string, { title: string; artist: string }>
  respondedByGuestId: string
}

function key(guestId: string, eventId: string) {
  return `${guestId}::${eventId}` as RsvpKey
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

function buildInitialState(data: RsvpGroupResponse): FormState {
  const rsvps: FormState['rsvps'] = {}
  for (const ev of data.events) {
    for (const guestId of ev.invitedGuestIds) {
      const existing = data.rsvps.find(
        (r) => r.guestId === guestId && r.eventId === ev.id,
      )
      rsvps[key(guestId, ev.id)] = {
        status: existing?.status ?? 'pending',
        mealChoiceId: existing?.mealChoiceId ?? null,
      }
    }
  }
  const dietary: FormState['dietary'] = {}
  const notes: FormState['notes'] = {}
  const songs: FormState['songs'] = {}
  for (const g of data.guests) {
    dietary[g.id] = g.dietaryRestrictions ?? ''
    notes[g.id] = g.notes ?? ''
    const sr = g.notesJson?.songRequest
    songs[g.id] = {
      title: sr?.title ?? '',
      artist: sr?.artist ?? '',
    }
  }
  return {
    rsvps,
    dietary,
    notes,
    songs,
    respondedByGuestId: data.actingGuestId || data.guests[0]?.id || '',
  }
}

function RsvpFull() {
  const { code = '' } = useParams<{ code: string }>()
  const [data, setData] = useState<RsvpGroupResponse | null>(null)
  const [state, setState] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    rsvpGroupGet(code)
      .then((res) => {
        if (cancelled) return
        setData(res)
        setState(buildInitialState(res))
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
      const k = key(guestId, eventId)
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
      const k = key(guestId, eventId)
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
      await rsvpGroupSubmit(code, submission)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`${styles.page} ${styles.background}`}>
      <div className={styles.content}>
        <Link to="/" className={styles.backLink}>
          ← Back to home
        </Link>

        {loading && <p>Loading your invitation…</p>}
        {loadError && <p className={styles.error}>{loadError}</p>}

        {data && state && !submitted && (
          <>
            <h1 className={styles.heading}>RSVP</h1>
            <div className={styles.subheading}>{data.group.label}</div>

            {data.events.length === 0 && (
              <p style={{ textAlign: 'center' }}>
                No events are open for RSVP yet — check back soon.
              </p>
            )}

            {data.events.map((ev) => (
              <EventCardEditor
                key={ev.id}
                event={ev}
                guestById={guestById}
                state={state}
                onStatusChange={setStatus}
                onMealChange={setMeal}
              />
            ))}

            <div className={styles.detailsCard}>
              <h2 style={{ margin: 0 }}>Other details</h2>
              {data.guests.map((g) => (
                <div key={g.id}>
                  <label className={styles.fieldLabel}>
                    {g.displayName} — Dietary restrictions or allergies
                  </label>
                  <input
                    type="text"
                    className={styles.select}
                    value={state.dietary[g.id] ?? ''}
                    onChange={(e) =>
                      setState((s) =>
                        s
                          ? { ...s, dietary: { ...s.dietary, [g.id]: e.target.value } }
                          : s,
                      )
                    }
                  />
                </div>
              ))}

              <label className={styles.fieldLabel}>
                Song request (optional)
              </label>
              <input
                type="text"
                className={styles.select}
                placeholder="Song title"
                value={state.songs[data.guests[0].id]?.title ?? ''}
                onChange={(e) =>
                  setState((s) =>
                    s
                      ? {
                          ...s,
                          songs: {
                            ...s.songs,
                            [data.guests[0].id]: {
                              ...(s.songs[data.guests[0].id] ?? {
                                title: '',
                                artist: '',
                              }),
                              title: e.target.value,
                            },
                          },
                        }
                      : s,
                  )
                }
              />
              <input
                type="text"
                className={styles.select}
                placeholder="Artist (optional)"
                style={{ marginTop: 8 }}
                value={state.songs[data.guests[0].id]?.artist ?? ''}
                onChange={(e) =>
                  setState((s) =>
                    s
                      ? {
                          ...s,
                          songs: {
                            ...s.songs,
                            [data.guests[0].id]: {
                              ...(s.songs[data.guests[0].id] ?? {
                                title: '',
                                artist: '',
                              }),
                              artist: e.target.value,
                            },
                          },
                        }
                      : s,
                  )
                }
              />

              <label className={styles.fieldLabel}>
                Anything else we should know?
              </label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={state.notes[data.guests[0].id] ?? ''}
                onChange={(e) =>
                  setState((s) =>
                    s
                      ? {
                          ...s,
                          notes: {
                            ...s.notes,
                            [data.guests[0].id]: e.target.value,
                          },
                        }
                      : s,
                  )
                }
              />
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
            {submitError && <div className={styles.error}>{submitError}</div>}
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

function EventCardEditor({
  event,
  guestById,
  state,
  onStatusChange,
  onMealChange,
}: {
  event: EventDetails
  guestById: Map<string, Guest>
  state: FormState
  onStatusChange: (guestId: string, eventId: string, status: RsvpStatus) => void
  onMealChange: (guestId: string, eventId: string, mealChoiceId: string) => void
}) {
  const dateText = formatDate(event.startsAt)
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
        const k = key(guestId, event.id)
        const current = state.rsvps[k] ?? { status: 'pending', mealChoiceId: null }
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
                    onChange={(e) => onMealChange(guestId, event.id, e.target.value)}
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

export default RsvpFull
