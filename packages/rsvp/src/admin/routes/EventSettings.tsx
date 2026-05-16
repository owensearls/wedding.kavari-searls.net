'use client'

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import {
  deleteEvent,
  listEvents,
  listEventStats,
  saveEvent,
  type AdminEventRecord,
  type AdminEventStats,
} from '../../server/admin/events'
import { formatForDisplay } from '../lib/dateHelpers'
import { EditEventForm } from './EditEventForm'
import type { AdminEventInput } from '../../schema'

const blankEvent = (): AdminEventInput => ({
  name: '',
  slug: '',
  startsAt: '',
  endsAt: '',
  locationName: '',
  address: '',
  rsvpDeadline: '',
  sortOrder: 0,
  notesSchema: [],
})

export function EventSettings() {
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [stats, setStats] = useState<AdminEventStats[]>([])
  const [editing, setEditing] = useState<AdminEventInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [r, s] = await Promise.all([listEvents(), listEventStats()])
      setEvents(r.events)
      setStats(s.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const statsByEvent = new Map(stats.map((s) => [s.eventId, s]))

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

  async function onDelete(ev: AdminEventRecord) {
    const ok = window.confirm(
      `Delete event "${ev.name}"? This will also remove its invitations and RSVP responses.`
    )
    if (!ok) return
    setError(null)
    try {
      await deleteEvent(ev.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
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
              <th>Invited</th>
              <th>Attending</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const s = statsByEvent.get(ev.id)
              return (
                <tr key={ev.id}>
                  <td>
                    {ev.name}
                    {ev.schemaMalformed && (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ color: '#b91c1c', cursor: 'pointer' }}
                        >
                          Schema malformed — {ev.schemaError}
                        </summary>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            background: '#f4f1ea',
                            padding: 8,
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          {ev.schemaRaw ?? '(empty)'}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td>
                    <code>{ev.slug}</code>
                  </td>
                  <td>{formatForDisplay(ev.startsAt)}</td>
                  <td>{ev.locationName ?? ''}</td>
                  <td>{s?.invitedCount ?? 0}</td>
                  <td>
                    {s?.attendingCount ?? 0}
                    {s && s.declinedCount > 0
                      ? ` (${s.declinedCount} declined)`
                      : ''}
                  </td>
                  <td>
                    {!ev.schemaMalformed && (
                      <Button variant="ghost" onClick={() => setEditing(ev)}>
                        Edit
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => onDelete(ev)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </div>
  )
}
