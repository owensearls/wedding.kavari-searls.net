import { useEffect, useState } from 'react'
import type { AdminEventInput } from '@shared/schemas/admin'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorMessage from '../../components/ui/ErrorMessage'
import LoadingIndicator from '../../components/ui/LoadingIndicator'
import PageHeader from '../../components/ui/PageHeader'
import Table from '../../components/ui/Table'
import { listEvents, saveEvent, type AdminEventRecord } from '../api'
import { formatForDisplay } from '../lib/dateHelpers'
import EditEventForm from './EditEventForm'

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
      <PageHeader
        title="Events"
        actions={
          <Button onClick={() => setEditing(blankEvent())}>New event</Button>
        }
      />

      <ErrorMessage>{error}</ErrorMessage>

      {loading ? (
        <LoadingIndicator />
      ) : events.length === 0 ? (
        <EmptyState>No events yet.</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Starts</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.name}</td>
                <td>
                  <code>{ev.slug}</code>
                </td>
                <td>{formatForDisplay(ev.startsAt)}</td>
                <td>{ev.locationName ?? ''}</td>
                <td>
                  <Button variant="ghost" onClick={() => setEditing(ev)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}

export default EventSettings
