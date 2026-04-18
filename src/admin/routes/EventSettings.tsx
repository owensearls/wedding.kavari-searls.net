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

  if (editing) {
    return (
      <EditEventForm
        event={editing}
        saving={saving}
        error={error}
        onChange={setEditing}
        onSave={onSave}
        onCancel={() => {
          setEditing(null)
          setError(null)
        }}
      />
    )
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
    </div>
  )
}

function EditEventForm({
  event,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  event: AdminEventInput
  saving: boolean
  error: string | null
  onChange: (next: AdminEventInput) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className={styles.editForm}>
      <div className={styles.editFormHeader}>
        <h2 className={styles.editFormTitle}>
          {event.id ? 'Edit event' : 'New event'}
        </h2>
        <button type="button" className="admin-button ghost" onClick={onCancel}>
          ← Back to list
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.editFormSection}>
        <div className={styles.sectionLabel}>Details</div>
        <div className={styles.formGrid2}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Name</label>
            <input
              className="admin-input"
              value={event.name}
              onChange={(e) => onChange({ ...event, name: e.target.value })}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              Slug <span className={styles.fieldHint}>(lowercase, no spaces)</span>
            </label>
            <input
              className="admin-input"
              value={event.slug}
              onChange={(e) => onChange({ ...event, slug: e.target.value })}
            />
          </div>
        </div>
        <div className={styles.formGrid2} style={{ marginTop: 12 }}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Location name</label>
            <input
              className="admin-input"
              value={event.locationName ?? ''}
              onChange={(e) =>
                onChange({ ...event, locationName: e.target.value })
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Address</label>
            <input
              className="admin-input"
              value={event.address ?? ''}
              onChange={(e) =>
                onChange({ ...event, address: e.target.value })
              }
            />
          </div>
        </div>
        <div className={styles.fieldGroup} style={{ marginTop: 12, maxWidth: 120 }}>
          <label className={styles.fieldLabel}>Sort order</label>
          <input
            className="admin-input"
            type="number"
            value={event.sortOrder}
            onChange={(e) =>
              onChange({ ...event, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className={styles.editFormSection}>
        <div className={styles.sectionLabel}>Schedule</div>
        <div className={styles.formGrid3}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Starts at</label>
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.startsAt)}
              onChange={(e) =>
                onChange({ ...event, startsAt: localInputToIso(e.target.value) })
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Ends at</label>
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.endsAt)}
              onChange={(e) =>
                onChange({ ...event, endsAt: localInputToIso(e.target.value) })
              }
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>RSVP deadline</label>
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.rsvpDeadline)}
              onChange={(e) =>
                onChange({
                  ...event,
                  rsvpDeadline: localInputToIso(e.target.value),
                })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.editFormSection}>
        <div className={styles.sectionLabel}>Meal options</div>
        <label className={styles.checkboxLabel} style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={event.requiresMealChoice}
            onChange={(e) =>
              onChange({ ...event, requiresMealChoice: e.target.checked })
            }
          />
          Requires meal choice
        </label>

        {event.requiresMealChoice && (
          <>
            {event.mealOptions.map((m, idx) => (
              <div className={styles.mealOptionRow} key={idx}>
                <input
                  className="admin-input"
                  placeholder="Meal name"
                  value={m.label}
                  onChange={(e) => {
                    const next = [...event.mealOptions]
                    next[idx] = { ...m, label: e.target.value }
                    onChange({ ...event, mealOptions: next })
                  }}
                />
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => {
                    const next = event.mealOptions.filter((_, i) => i !== idx)
                    onChange({ ...event, mealOptions: next })
                  }}
                  title="Remove meal option"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="admin-button ghost"
              onClick={() =>
                onChange({
                  ...event,
                  mealOptions: [
                    ...event.mealOptions,
                    { label: '', description: '' },
                  ],
                })
              }
            >
              + Add meal option
            </button>
          </>
        )}
      </div>

      <div className={styles.editFormActions}>
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
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default EventSettings
