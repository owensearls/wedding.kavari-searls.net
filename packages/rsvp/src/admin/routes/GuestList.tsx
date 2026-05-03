'use client'

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import { listEvents, type AdminEventRecord } from '../../server/admin/events'
import {
  deleteGroup,
  getGroup,
  listGroups,
  saveGroup,
} from '../../server/admin/groups'
import { listResponses } from '../../server/admin/responses'
import { downloadCsv, responsesToCsv } from '../lib/rsvpCsv'
import { EditGroupForm } from './EditGroupForm'
import { GroupBlock } from './GroupBlock'
import { GuestDetailModal } from './GuestDetailModal'
import styles from './GuestList.module.css'
import type {
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestInput,
  CustomFieldConfig,
} from '../../schema'

const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

const blankGroup = (): AdminGroupInput => ({
  label: '',
  guests: [blankGuest()],
  invitedEventIds: [],
})

export function GuestList() {
  const [groups, setGroups] = useState<AdminGroupListItem[]>([])
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [guestCustomFields, setGuestCustomFields] = useState<CustomFieldConfig[]>([])
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
      setGuestCustomFields(g.guestCustomFields)
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

  async function onDelete(id: string) {
    if (!confirm('Delete this invite and all its guests/RSVPs?')) return
    try {
      await deleteGroup(id)
      setEditing(null)
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
        csv
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
        serverError={error}
        onSubmit={async (data) => {
          setSaving(true)
          setError(null)
          try {
            await saveGroup(data)
            setEditing(null)
            await refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Save failed')
          } finally {
            setSaving(false)
          }
        }}
        onDelete={editing.id ? () => onDelete(editing.id!) : undefined}
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
  const colCount = 2 + eventColumns.length + 1 + guestCustomFields.length + 1
  // name + code + events + notes + custom + edit

  return (
    <div>
      <PageHeader
        title="Guests"
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.assign('/admin/import/')
              }}
            >
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
              {guestCustomFields.map((f, i) => (
                <th
                  key={f.id}
                  className={i === 0 ? styles.customDivider : undefined}
                >
                  {f.label}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupBlock
                key={g.id}
                group={g}
                eventColumns={eventColumns}
                guestCustomFields={guestCustomFields}
                colCount={colCount}
                onEdit={() => startEdit(g.id)}
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
