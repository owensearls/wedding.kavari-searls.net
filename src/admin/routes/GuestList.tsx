import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  deleteGroup,
  getGroup,
  getGuest,
  listEvents,
  listGroups,
  listResponses,
  saveGroup,
  type AdminEventRecord,
} from '../api'
import type {
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestDetail,
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
  const navigate = useNavigate()
  const [groups, setGroups] = useState<AdminGroupListItem[]>([])
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminGroupInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailGuestId, setDetailGuestId] = useState<string | null>(null)

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
    if (!confirm('Delete this invite and all its guests/RSVPs?')) return
    try {
      await deleteGroup(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function onExport() {
    setError(null)
    try {
      const res = await listResponses()
      const header = [
        'groupLabel',
        'inviteCode',
        'guestName',
        'eventName',
        'status',
        'mealLabel',
        'dietaryRestrictions',
        'respondedAt',
      ]
      const escape = (v: string | null) =>
        v === null ? '' : `"${v.replace(/"/g, '""')}"`
      const csv = [
        header.join(','),
        ...res.rows.map((r) =>
          [
            r.groupLabel,
            r.inviteCode,
            r.guestName,
            r.eventName,
            r.status,
            r.mealLabel,
            r.dietaryRestrictions,
            r.respondedAt,
          ]
            .map(escape)
            .join(','),
        ),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rsvp-responses-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
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

  // Sorted events for the column layout.
  const eventColumns = [...events].sort((a, b) => {
    const ao = a.sortOrder ?? 0
    const bo = b.sortOrder ?? 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })

  const colCount = 2 + eventColumns.length + 1 // name + code + events + notes

  return (
    <div>
      <div className={`${styles.row} ${styles.card}`}>
        <h2 style={{ margin: 0, flex: 1 }}>Guests</h2>
        <button
          type="button"
          className="admin-button ghost"
          onClick={() => navigate('/import')}
        >
          Import CSV
        </button>
        <button
          type="button"
          className="admin-button ghost"
          onClick={onExport}
          disabled={groups.length === 0}
        >
          Export CSV
        </button>
        <button
          type="button"
          className="admin-button"
          onClick={() => setEditing(blankGroup())}
        >
          New invite
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
                <th>Invite code</th>
                {eventColumns.map((ev) => (
                  <th key={ev.id}>{ev.name}</th>
                ))}
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={colCount} className={styles.muted}>
                    No guests yet — create an invite or use the Import page.
                  </td>
                </tr>
              )}
              {groups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  eventColumns={eventColumns}
                  colCount={colCount}
                  onEdit={() => startEdit(g.id)}
                  onDelete={() => onDelete(g.id)}
                  onOpenGuest={(guestId) => setDetailGuestId(guestId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailGuestId && (
        <GuestDetailModal
          key={detailGuestId}
          guestId={detailGuestId}
          onClose={() => setDetailGuestId(null)}
        />
      )}
    </div>
  )
}

function GroupBlock({
  group,
  eventColumns,
  colCount,
  onEdit,
  onDelete,
  onOpenGuest,
}: {
  group: AdminGroupListItem
  eventColumns: AdminEventRecord[]
  colCount: number
  onEdit: () => void
  onDelete: () => void
  onOpenGuest: (guestId: string) => void
}) {
  return (
    <>
      <tr className={styles.groupHeaderRow}>
        <td colSpan={colCount}>
          <div className={styles.groupHeaderContent}>
            <span className={styles.groupHeaderLabel}>{group.label}</span>
            <span className={styles.groupHeaderStats}>
              {group.guestCount} guest{group.guestCount === 1 ? '' : 's'} ·{' '}
              <span className={styles.statusAttending}>
                {group.attendingCount} attending
              </span>{' '}
              ·{' '}
              <span className={styles.statusDeclined}>
                {group.declinedCount} declined
              </span>{' '}
              ·{' '}
              <span className={styles.statusPending}>
                {group.pendingCount} pending
              </span>
            </span>
            <span className={styles.groupHeaderActions}>
              <button
                type="button"
                className="admin-button ghost"
                onClick={onEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-button ghost"
                onClick={onDelete}
              >
                Delete
              </button>
            </span>
          </div>
        </td>
      </tr>
      {group.guests.map((guest) => (
        <tr
          key={guest.id}
          className={styles.guestClickRow}
          onClick={() => onOpenGuest(guest.id)}
        >
          <td>{guest.displayName}</td>
          <td>
            <a
              href={`/rsvp/${encodeURIComponent(guest.inviteCode)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={styles.codeLink}
            >
              {guest.inviteCode}
            </a>
          </td>
          {eventColumns.map((ev) => {
            const s = guest.eventStatuses.find((es) => es.eventId === ev.id)
            return (
              <td key={ev.id} className={statusClassFor(s?.status)}>
                {statusLabel(s?.status)}
                {s?.mealLabel ? (
                  <span className={styles.mealHint}> · {s.mealLabel}</span>
                ) : null}
              </td>
            )
          })}
          <td className={styles.notesCell}>
            {[guest.dietaryRestrictions, guest.notes]
              .filter(Boolean)
              .join(' · ')}
          </td>
        </tr>
      ))}
    </>
  )
}

function statusLabel(
  status: 'pending' | 'attending' | 'declined' | 'not-invited' | undefined,
): string {
  switch (status) {
    case 'attending':
      return 'Attending'
    case 'declined':
      return 'Declined'
    case 'pending':
      return 'Pending'
    case 'not-invited':
    case undefined:
      return '—'
  }
}

function statusClassFor(
  status: 'pending' | 'attending' | 'declined' | 'not-invited' | undefined,
): string | undefined {
  switch (status) {
    case 'attending':
      return styles.statusAttending
    case 'declined':
      return styles.statusDeclined
    case 'pending':
      return styles.statusPending
    case 'not-invited':
    case undefined:
      return styles.statusNotInvited
  }
}

function GuestDetailModal({
  guestId,
  onClose,
}: {
  guestId: string
  onClose: () => void
}) {
  const [data, setData] = useState<AdminGuestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGuest(guestId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [guestId])

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 style={{ margin: 0 }}>
            {data?.displayName ?? 'Guest details'}
          </h2>
          <button
            type="button"
            className="admin-button ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {!data && !error && <p>Loading…</p>}

        {data && (
          <div className={styles.modalBody}>
            <div className={styles.detailGrid}>
              <div className={styles.detailLabel}>Group</div>
              <div>{data.groupLabel}</div>
              <div className={styles.detailLabel}>Invite code</div>
              <div>
                <a
                  href={`/rsvp/${encodeURIComponent(data.inviteCode)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.codeLink}
                >
                  {data.inviteCode}
                </a>
              </div>
              {data.email && (
                <>
                  <div className={styles.detailLabel}>Email</div>
                  <div>{data.email}</div>
                </>
              )}
              {data.phone && (
                <>
                  <div className={styles.detailLabel}>Phone</div>
                  <div>{data.phone}</div>
                </>
              )}
              {data.dietaryRestrictions && (
                <>
                  <div className={styles.detailLabel}>Dietary</div>
                  <div>{data.dietaryRestrictions}</div>
                </>
              )}
              {data.notes && (
                <>
                  <div className={styles.detailLabel}>Notes</div>
                  <div>{data.notes}</div>
                </>
              )}
            </div>

            <h3 style={{ marginTop: 18 }}>Events</h3>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Meal</th>
                    <th>Responded</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.length === 0 && (
                    <tr>
                      <td colSpan={5} className={styles.muted}>
                        Not invited to any events yet.
                      </td>
                    </tr>
                  )}
                  {data.events.map((e) => (
                    <tr key={e.eventId}>
                      <td>{e.eventName}</td>
                      <td className={statusClassFor(e.status)}>
                        {statusLabel(e.status)}
                      </td>
                      <td>{e.mealLabel ?? '—'}</td>
                      <td>
                        {e.respondedAt
                          ? new Date(e.respondedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td>{e.respondedByDisplayName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.notesJson?.songRequest && (
              <>
                <h3 style={{ marginTop: 18 }}>Song request</h3>
                <p>
                  {data.notesJson.songRequest.title}
                  {data.notesJson.songRequest.artist
                    ? ` — ${data.notesJson.songRequest.artist}`
                    : ''}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
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
    <div className={styles.editForm}>
      <div className={styles.editFormHeader}>
        <h2 className={styles.editFormTitle}>
          {group.id ? 'Edit invite' : 'New invite'}
        </h2>
        <button type="button" className="admin-button ghost" onClick={onCancel}>
          ← Back to list
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.editFormSection}>
        <div className={styles.sectionLabel}>Guest</div>
        <div className={styles.guestRowPrimary}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>First name</label>
            <input
              className="admin-input"
              value={group.guests[0]?.firstName ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[0] = { ...next[0], firstName: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Last name</label>
            <input
              className="admin-input"
              value={group.guests[0]?.lastName ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[0] = { ...next[0], lastName: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Email</label>
            <input
              className="admin-input"
              value={group.guests[0]?.email ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[0] = { ...next[0], email: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Phone</label>
            <input
              className="admin-input"
              value={group.guests[0]?.phone ?? ''}
              onChange={(e) => {
                const next = [...group.guests]
                next[0] = { ...next[0], phone: e.target.value }
                onChange({ ...group, guests: next })
              }}
            />
          </div>
        </div>
      </div>

      <div className={styles.editFormSection}>
        <div className={styles.sectionRow}>
          <div className={styles.sectionLabel}>Additional guests</div>
          <button
            type="button"
            className="admin-button ghost"
            onClick={() =>
              onChange({ ...group, guests: [...group.guests, blankGuest()] })
            }
          >
            + Add
          </button>
        </div>

        {group.guests.length > 1 ? (
          <>
            <div className={styles.fieldGroup} style={{ maxWidth: 360, marginBottom: 16 }}>
              <label className={styles.fieldLabel}>
                Invite label <span className={styles.fieldHint}>(optional)</span>
              </label>
              <input
                className="admin-input"
                placeholder="e.g. The Smith family"
                value={group.label}
                onChange={(e) => onChange({ ...group, label: e.target.value })}
              />
            </div>
            <div className={`${styles.guestRow} ${styles.guestRowHeader}`}>
              <span>First</span>
              <span>Last</span>
              <span>Email</span>
              <span>Phone</span>
              <span></span>
            </div>
            {group.guests.slice(1).map((guest, i) => {
              const idx = i + 1
              return (
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
                    className={styles.removeBtn}
                    onClick={() => {
                      const next = group.guests.filter((_, j) => j !== idx)
                      onChange({ ...group, guests: next })
                    }}
                    title="Remove guest"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </>
        ) : (
          <p className={styles.muted}>
            No additional guests on this invite yet.
          </p>
        )}
      </div>

      <div className={styles.editFormSection}>
        <div className={styles.sectionLabel}>Invited to</div>
        {events.length === 0 ? (
          <p className={styles.muted}>
            Create some events on the Events tab first.
          </p>
        ) : (
          <div className={styles.eventCheckboxes}>
            {events.map((ev) => (
              <label key={ev.id} className={styles.eventCheckbox}>
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
                <span>{ev.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.editFormActions}>
        <button
          type="button"
          className="admin-button"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save invite'}
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

export default GuestList
