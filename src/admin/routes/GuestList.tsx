import { useEffect, useState } from 'react'
import {
  deleteGroup,
  getGroup,
  listEvents,
  listGroups,
  saveGroup,
  type AdminEventRecord,
} from '../api'
import type {
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestInput,
} from '@shared/schemas/admin'
import styles from '../AdminApp.module.css'

const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  ageGroup: 'adult',
  isPlusOne: false,
  dietaryRestrictions: '',
  notes: '',
})

const blankGroup = (): AdminGroupInput => ({
  label: '',
  notes: '',
  guests: [blankGuest()],
  invitedEventIds: [],
})

function GuestList() {
  const [groups, setGroups] = useState<AdminGroupListItem[]>([])
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminGroupInput | null>(null)
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [g, e] = await Promise.all([listGroups(), listEvents()])
      setGroups(g.groups)
      setEvents(e.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function startEdit(id: string) {
    try {
      const data = await getGroup(id)
      setEditing(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group')
    }
  }

  async function onSave() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      await saveGroup(editing)
      setEditing(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this group and all its guests/RSVPs?')) return
    try {
      await deleteGroup(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div>
      <div className={`${styles.row} ${styles.card}`}>
        <h2 style={{ margin: 0, flex: 1 }}>Guest groups</h2>
        <button
          type="button"
          className="admin-button"
          onClick={() => setEditing(blankGroup())}
        >
          New group
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
                <th>Label</th>
                <th>Invite code</th>
                <th>Guests</th>
                <th>Attending</th>
                <th>Declined</th>
                <th>Pending</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    No groups yet — create one or use the Import page.
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>{g.label}</td>
                  <td>
                    <code>{g.inviteCode}</code>
                  </td>
                  <td>{g.guestCount}</td>
                  <td>{g.attendingCount}</td>
                  <td>{g.declinedCount}</td>
                  <td>{g.pendingCount}</td>
                  <td className={styles.row}>
                    <button
                      type="button"
                      className="admin-button ghost"
                      onClick={() => startEdit(g.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-button ghost"
                      onClick={() => onDelete(g.id)}
                    >
                      Delete
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
          <h3>{editing.id ? 'Edit group' : 'New group'}</h3>
          <label className={styles.label}>Label (e.g. "The Smith family")</label>
          <input
            className="admin-input"
            value={editing.label}
            onChange={(e) =>
              setEditing({ ...editing, label: e.target.value })
            }
          />

          <h4 style={{ marginTop: 18 }}>Guests</h4>
          <div className={styles.guestRow} style={{ fontWeight: 600 }}>
            <span>First</span>
            <span>Last</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Age</span>
            <span>+1?</span>
            <span></span>
          </div>
          {editing.guests.map((guest, idx) => (
            <div className={styles.guestRow} key={idx}>
              <input
                className="admin-input"
                value={guest.firstName}
                onChange={(e) => {
                  const next = [...editing.guests]
                  next[idx] = { ...guest, firstName: e.target.value }
                  setEditing({ ...editing, guests: next })
                }}
              />
              <input
                className="admin-input"
                value={guest.lastName ?? ''}
                onChange={(e) => {
                  const next = [...editing.guests]
                  next[idx] = { ...guest, lastName: e.target.value }
                  setEditing({ ...editing, guests: next })
                }}
              />
              <input
                className="admin-input"
                value={guest.email ?? ''}
                onChange={(e) => {
                  const next = [...editing.guests]
                  next[idx] = { ...guest, email: e.target.value }
                  setEditing({ ...editing, guests: next })
                }}
              />
              <input
                className="admin-input"
                value={guest.phone ?? ''}
                onChange={(e) => {
                  const next = [...editing.guests]
                  next[idx] = { ...guest, phone: e.target.value }
                  setEditing({ ...editing, guests: next })
                }}
              />
              <select
                className="admin-select"
                value={guest.ageGroup}
                onChange={(e) => {
                  const next = [...editing.guests]
                  next[idx] = {
                    ...guest,
                    ageGroup: e.target.value as 'adult' | 'child' | 'infant',
                  }
                  setEditing({ ...editing, guests: next })
                }}
              >
                <option value="adult">Adult</option>
                <option value="child">Child</option>
                <option value="infant">Infant</option>
              </select>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={guest.isPlusOne}
                  onChange={(e) => {
                    const next = [...editing.guests]
                    next[idx] = { ...guest, isPlusOne: e.target.checked }
                    setEditing({ ...editing, guests: next })
                  }}
                />
              </label>
              <button
                type="button"
                className="admin-button ghost"
                onClick={() => {
                  const next = editing.guests.filter((_, i) => i !== idx)
                  setEditing({
                    ...editing,
                    guests: next.length > 0 ? next : [blankGuest()],
                  })
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
              setEditing({ ...editing, guests: [...editing.guests, blankGuest()] })
            }
          >
            Add guest
          </button>

          <h4 style={{ marginTop: 18 }}>Invited to</h4>
          {events.length === 0 && (
            <p className={styles.muted}>
              Create some events on the Events tab first.
            </p>
          )}
          <div className={styles.row}>
            {events.map((ev) => (
              <label key={ev.id} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editing.invitedEventIds.includes(ev.id!)}
                  onChange={(e) => {
                    const set = new Set(editing.invitedEventIds)
                    if (e.target.checked) set.add(ev.id!)
                    else set.delete(ev.id!)
                    setEditing({ ...editing, invitedEventIds: [...set] })
                  }}
                />
                {ev.name}
              </label>
            ))}
          </div>

          <div className={styles.row} style={{ marginTop: 18 }}>
            <button
              type="button"
              className="admin-button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save group'}
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

export default GuestList
