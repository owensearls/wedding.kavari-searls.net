import { useEffect, useState } from 'react'
import { listEvents, saveEvent, type AdminEventRecord } from '../api'
import type { AdminEventInput } from '@shared/schemas/admin'
import styles from '../AdminApp.module.css'

const blankEvent = (): AdminEventInput => ({
  name: '',
  slug: '',
  startsAt: '',
  endsAt: '',
  locationName: '',
  address: '',
  rsvpDeadline: '',
  requiresMealChoice: false,
  sortOrder: 0,
  mealOptions: [],
})

// --- Date helpers ------------------------------------------------------------
//
// <input type="datetime-local"> works with "YYYY-MM-DDTHH:MM" strings in the
// user's local wall clock, with no timezone. The DB stores whatever we send;
// we keep things simple by round-tripping local wall-clock ISO strings of the
// form "YYYY-MM-DDTHH:MM:00" (no offset). Browsers parse these as local time,
// which is what we want for a wedding with a single venue timezone.

const pad = (n: number) => String(n).padStart(2, '0')

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function localInputToIso(v: string): string | null {
  if (!v) return null
  const trimmed = v.slice(0, 16)
  return trimmed.length === 16 ? `${trimmed}:00` : null
}

function formatForDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function EventSettings() {
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [editing, setEditing] = useState<AdminEventInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const r = await listEvents()
      setEvents(r.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onSave() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      await saveEvent(editing)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={`${styles.row} ${styles.card}`}>
        <h2 style={{ margin: 0, flex: 1 }}>Events</h2>
        <button
          type="button"
          className="admin-button"
          onClick={() => setEditing(blankEvent())}
        >
          New event
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Starts</th>
                <th>Location</th>
                <th>Meal?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.muted}>
                    No events yet.
                  </td>
                </tr>
              )}
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.name}</td>
                  <td>
                    <code>{ev.slug}</code>
                  </td>
                  <td>{formatForDisplay(ev.startsAt)}</td>
                  <td>{ev.locationName ?? ''}</td>
                  <td>{ev.requiresMealChoice ? 'Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-button ghost"
                      onClick={() => setEditing(ev)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className={styles.card} style={{ marginTop: 24 }}>
          <h3>{editing.id ? 'Edit event' : 'New event'}</h3>
          <label className={styles.label}>Name</label>
          <input
            className="admin-input"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <label className={styles.label}>Slug (lowercase, no spaces)</label>
          <input
            className="admin-input"
            value={editing.slug}
            onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
          />
          <label className={styles.label}>Starts at</label>
          <input
            className="admin-input"
            type="datetime-local"
            value={isoToLocalInput(editing.startsAt)}
            onChange={(e) =>
              setEditing({
                ...editing,
                startsAt: localInputToIso(e.target.value),
              })
            }
          />
          <label className={styles.label}>Location name</label>
          <input
            className="admin-input"
            value={editing.locationName ?? ''}
            onChange={(e) =>
              setEditing({ ...editing, locationName: e.target.value })
            }
          />
          <label className={styles.label}>Address</label>
          <input
            className="admin-input"
            value={editing.address ?? ''}
            onChange={(e) =>
              setEditing({ ...editing, address: e.target.value })
            }
          />
          <label className={styles.label}>RSVP deadline</label>
          <input
            className="admin-input"
            type="datetime-local"
            value={isoToLocalInput(editing.rsvpDeadline)}
            onChange={(e) =>
              setEditing({
                ...editing,
                rsvpDeadline: localInputToIso(e.target.value),
              })
            }
          />
          <label className={styles.label}>Sort order</label>
          <input
            className="admin-input"
            type="number"
            value={editing.sortOrder}
            onChange={(e) =>
              setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })
            }
          />
          <label
            className={styles.checkboxLabel}
            style={{ marginTop: 12, display: 'flex' }}
          >
            <input
              type="checkbox"
              checked={editing.requiresMealChoice}
              onChange={(e) =>
                setEditing({ ...editing, requiresMealChoice: e.target.checked })
              }
            />
            Requires meal choice
          </label>

          {editing.requiresMealChoice && (
            <>
              <h4>Meal options</h4>
              {editing.mealOptions.map((m, idx) => (
                <div className={styles.row} key={idx} style={{ marginBottom: 8 }}>
                  <input
                    className="admin-input"
                    placeholder="Label"
                    value={m.label}
                    onChange={(e) => {
                      const next = [...editing.mealOptions]
                      next[idx] = { ...m, label: e.target.value }
                      setEditing({ ...editing, mealOptions: next })
                    }}
                  />
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={m.isVegetarian}
                      onChange={(e) => {
                        const next = [...editing.mealOptions]
                        next[idx] = { ...m, isVegetarian: e.target.checked }
                        setEditing({ ...editing, mealOptions: next })
                      }}
                    />
                    Vegetarian
                  </label>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={m.isChildMeal}
                      onChange={(e) => {
                        const next = [...editing.mealOptions]
                        next[idx] = { ...m, isChildMeal: e.target.checked }
                        setEditing({ ...editing, mealOptions: next })
                      }}
                    />
                    Child
                  </label>
                  <button
                    type="button"
                    className="admin-button ghost"
                    onClick={() => {
                      const next = editing.mealOptions.filter(
                        (_, i) => i !== idx,
                      )
                      setEditing({ ...editing, mealOptions: next })
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="admin-button ghost"
                onClick={() =>
                  setEditing({
                    ...editing,
                    mealOptions: [
                      ...editing.mealOptions,
                      {
                        label: '',
                        description: '',
                        isChildMeal: false,
                        isVegetarian: false,
                      },
                    ],
                  })
                }
              >
                Add meal option
              </button>
            </>
          )}

          <div className={styles.row} style={{ marginTop: 18 }}>
            <button
              type="button"
              className="admin-button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save event'}
            </button>
            <button
              type="button"
              className="admin-button ghost"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventSettings
