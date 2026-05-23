'use client'

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import {
  GroupedList,
  GroupedListEmptyBlock,
  GroupedListHeaderCell,
  GroupedListHeaderRow,
} from '../../components/ui/GroupedList'
import { PageHeader } from '../../components/ui/PageHeader'
import { listEvents, type AdminEventRecord } from '../../server/admin/events'
import {
  deleteGroup,
  getGroup,
  listGroups,
  saveGroup,
} from '../../server/admin/groups'
import { listResponses } from '../../server/admin/responses'
import { getAdminSettings } from '../../server/admin/settings'
import { downloadCsv, responsesToCsv } from '../lib/rsvpCsv'
import { EditGroupForm } from './EditGroupForm'
import { GroupBlock } from './GroupBlock'
import { GuestDetailModal } from './GuestDetailModal'
import styles from './GuestList.module.css'
import type {
  AdminFieldDraft,
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestInput,
} from '../../schema'

const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
})

const blankGroup = (defaults: AdminFieldDraft[]): AdminGroupInput => ({
  label: '',
  guests: [blankGuest()],
  invitedEventIds: [],
  notesSchema: defaults,
})

export function GuestList() {
  const [groups, setGroups] = useState<AdminGroupListItem[]>([])
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [defaultNotesSchema, setDefaultNotesSchema] = useState<
    AdminFieldDraft[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminGroupInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailGuestId, setDetailGuestId] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [g, e, s] = await Promise.all([
        listGroups(),
        listEvents(),
        getAdminSettings(),
      ])
      setGroups(g.groups)
      setEvents(e.events)
      setDefaultNotesSchema(s.notesSchema)
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
            <Button onClick={() => setEditing(blankGroup(defaultNotesSchema))}>
              New invite
            </Button>
          </>
        }
      />

      <ErrorMessage>{error}</ErrorMessage>

      <GroupedList className={styles.list} ariaLabel="Guests by group">
        <GroupedListHeaderRow>
          <GroupedListHeaderCell gutter>Group</GroupedListHeaderCell>
          <GroupedListHeaderCell>Name</GroupedListHeaderCell>
          <GroupedListHeaderCell>Invite code</GroupedListHeaderCell>
          <div className={styles.eventsHeader} role="presentation">
            {eventColumns.map((ev) => (
              <GroupedListHeaderCell
                key={ev.id}
                className={styles.eventsHeaderCell}
              >
                {ev.name}
              </GroupedListHeaderCell>
            ))}
          </div>
        </GroupedListHeaderRow>

        {loading ? (
          <>
            {[2, 1, 2].map((rowCount, blockIdx) => (
              <GroupBlock key={blockIdx} loading rowCount={rowCount} />
            ))}
          </>
        ) : groups.length === 0 ? (
          <GroupedListEmptyBlock>
            No guests yet — create an invite or use the Import page.
          </GroupedListEmptyBlock>
        ) : (
          groups.map((g) => (
            <GroupBlock
              key={g.id}
              group={g}
              eventColumns={eventColumns}
              onEdit={() => startEdit(g.id)}
              onOpenGuest={(guestId) => setDetailGuestId(guestId)}
            />
          ))
        )}
      </GroupedList>

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
