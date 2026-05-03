'use client'

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import {
  deleteGuestCustomField,
  listGuestCustomFields,
  saveGuestCustomField,
} from '../../server/admin/customFields'
import {
  listEvents,
  saveEvent,
  type AdminEventRecord,
} from '../../server/admin/events'
import { formatForDisplay } from '../lib/dateHelpers'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import { EditEventForm } from './EditEventForm'
import type {
  AdminCustomFieldInput,
  AdminEventInput,
  CustomFieldConfig,
} from '../../schema'

const blankEvent = (): AdminEventInput => ({
  name: '',
  slug: '',
  startsAt: '',
  endsAt: '',
  locationName: '',
  address: '',
  rsvpDeadline: '',
  sortOrder: 0,
  customFields: [],
})

function configToDraft(f: CustomFieldConfig): AdminCustomFieldInput {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    sortOrder: f.sortOrder,
    options: f.options.map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description,
      sortOrder: 0,
    })),
  }
}

export function EventSettings() {
  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [editing, setEditing] = useState<AdminEventInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Guest profile fields state
  const [guestFields, setGuestFields] = useState<CustomFieldConfig[]>([])
  const [guestFieldsDraft, setGuestFieldsDraft] = useState<
    AdminCustomFieldInput[]
  >([])
  const [guestFieldsDirty, setGuestFieldsDirty] = useState(false)
  const [guestFieldsError, setGuestFieldsError] = useState<string | null>(null)
  const [guestFieldsSaving, setGuestFieldsSaving] = useState(false)

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

  async function refreshGuestFields() {
    try {
      const r = await listGuestCustomFields()
      setGuestFields(r.fields)
      setGuestFieldsDraft(r.fields.map(configToDraft))
      setGuestFieldsDirty(false)
    } catch (err) {
      setGuestFieldsError(err instanceof Error ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    refresh()
    refreshGuestFields()
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

  async function saveGuestFields() {
    setGuestFieldsSaving(true)
    setGuestFieldsError(null)
    try {
      const submittedIds = new Set(
        guestFieldsDraft.map((f) => f.id).filter((x): x is string => !!x)
      )
      for (const existing of guestFields) {
        if (!submittedIds.has(existing.id)) {
          await deleteGuestCustomField(existing.id)
        }
      }
      for (let i = 0; i < guestFieldsDraft.length; i++) {
        await saveGuestCustomField({
          ...guestFieldsDraft[i],
          sortOrder: i,
        })
      }
      await refreshGuestFields()
    } catch (err) {
      setGuestFieldsError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setGuestFieldsSaving(false)
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
      <section style={{ marginBottom: 32 }}>
        <PageHeader title="Guest profile fields" />
        <ErrorMessage>{guestFieldsError}</ErrorMessage>
        <CustomFieldsEditor
          fields={guestFieldsDraft}
          onChange={(next) => {
            setGuestFieldsDraft(next)
            setGuestFieldsDirty(true)
          }}
        />
        {guestFieldsDirty && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button onClick={saveGuestFields} disabled={guestFieldsSaving}>
              {guestFieldsSaving ? 'Saving…' : 'Save guest profile fields'}
            </Button>
            <Button
              variant="ghost"
              onClick={refreshGuestFields}
              disabled={guestFieldsSaving}
            >
              Cancel
            </Button>
          </div>
        )}
      </section>

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
