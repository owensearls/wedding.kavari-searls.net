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

  if (editing) {
    return (
      <EditGroupForm
        group={editing}
        events={events}
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
                <GroupRows
                  key={g.id}
                  group={g}
                  onEdit={() => startEdit(g.id)}
                  onDelete={() => onDelete(g.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function GroupRows({
  group,
  onEdit,
  onDelete,
}: {
  group: AdminGroupListItem
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <>
      <tr className={styles.groupRow}>
        <td>{group.label}</td>
        <td>
          <code>{group.inviteCode}</code>
        </td>
        <td>{group.guestCount}</td>
        <td>{group.attendingCount}</td>
        <td>{group.declinedCount}</td>
        <td>{group.pendingCount}</td>
        <td className={styles.row}>
          <button type="button" className="admin-button ghost" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="admin-button ghost"
            onClick={onDelete}
          >
            Delete
          </button>
        </td>
      </tr>
      {group.guests.map((guest) => (
        <tr key={guest.id} className={styles.subRow}>
          <td colSpan={7}>
            <div className={styles.subRowContent}>
              <span className={styles.subRowName}>{guest.displayName}</span>
              {guest.email && (
                <span className={styles.subRowMeta}>{guest.email}</span>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

function EditGroupForm({
  group,
  events,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  group: AdminGroupInput
  events: AdminEventRecord[]
  saving: boolean
  error: string | null
  onChange: (next: AdminGroupInput) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div>
      <div className={`${styles.row} ${styles.card}`}>
        <h2 style={{ margin: 0, flex: 1 }}>
          {group.id ? 'Edit group' : 'New group'}
        </h2>
        <button type="button" className="admin-button ghost" onClick={onCancel}>
          ← Back to list
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.card}>
        <label className={styles.label}>Label (e.g. "The Smith family")</label>
        <input
          className="admin-input"
          value={group.label}
          onChange={(e) => onChange({ ...group, label: e.target.value })}
        />

        <h4 style={{ marginTop: 18 }}>Guests</h4>
        <div className={`${styles.guestRow} ${styles.guestRowHeader}`}>
          <span>First</span>
          <span>Last</span>
          <span>Email</span>
          <span>Phone</span>
          <span></span>
        </div>
        {group.guests.map((guest, idx) => (
          <div className={styles.guestRow} key={idx}>
            <input
              className="admin-input"
              value={guest.firstName}
              onChange={(e) => {
                const next = [...group.guests]
                next[idx] = { ...guest, firstName: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
            <input
              className="admin-input"
              value={guest.lastName ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[idx] = { ...guest, lastName: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
            <input
              className="admin-input"
              value={guest.email ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[idx] = { ...guest, email: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
            <input
              className="admin-input"
              value={guest.phone ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[idx] = { ...guest, phone: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
            <button
              type="button"
              className="admin-button ghost"
              onClick={() => {
                const next = group.guests.filter((_, i) => i !== idx)
                onChange({
                  ...group,
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
            onChange({ ...group, guests: [...group.guests, blankGuest()] })
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
                checked={(group.invitedEventIds ?? []).includes(ev.id!)}
                onChange={(e) => {
                  const set = new Set(group.invitedEventIds ?? [])
                  if (e.target.checked) set.add(ev.id!)
                  else set.delete(ev.id!)
                  onChange({ ...group, invitedEventIds: [...set] })
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
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default GuestList
