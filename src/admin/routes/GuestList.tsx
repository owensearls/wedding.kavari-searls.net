import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestInput,
} from '@shared/schemas/admin'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorMessage from '../../components/ui/ErrorMessage'
import LoadingIndicator from '../../components/ui/LoadingIndicator'
import PageHeader from '../../components/ui/PageHeader'
import Table from '../../components/ui/Table'
import {
  deleteGroup,
  getGroup,
  listEvents,
  listGroups,
  listResponses,
  saveGroup,
  type AdminEventRecord,
} from '../api'
import { downloadCsv, responsesToCsv } from '../lib/rsvpCsv'
import EditGroupForm from './EditGroupForm'
import GroupBlock from './GroupBlock'
import GuestDetailModal from './GuestDetailModal'

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
      const csv = responsesToCsv(res.rows)
      downloadCsv(
        `rsvp-responses-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      )
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

  const eventColumns = [...events].sort((a, b) => {
    const ao = a.sortOrder ?? 0
    const bo = b.sortOrder ?? 0
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })
  const colCount = 2 + eventColumns.length + 1 // name + code + events + notes

  return (
    <div>
      <PageHeader
        title="Guests"
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/import')}>
              Import CSV
            </Button>
            <Button
              variant="ghost"
              onClick={onExport}
              disabled={groups.length === 0}
            >
              Export CSV
            </Button>
            <Button onClick={() => setEditing(blankGroup())}>New invite</Button>
          </>
        }
      />

      <ErrorMessage>{error}</ErrorMessage>

      {loading ? (
        <LoadingIndicator />
      ) : groups.length === 0 ? (
        <EmptyState>
          No guests yet — create an invite or use the Import page.
        </EmptyState>
      ) : (
        <Table>
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
        </Table>
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

export default GuestList
