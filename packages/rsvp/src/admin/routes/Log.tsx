'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import {
  listGuestResponseLog,
  listRsvpResponseLog,
  type AdminGuestResponseLogRow,
  type AdminRsvpResponseLogRow,
} from '../../server/admin/responses'
import {
  formatCustomAnswers,
  renderCustomFieldValue,
} from '../lib/customFieldRender'
import guestListStyles from './GuestList.module.css'
import styles from './Log.module.css'
import type { CustomFieldConfig } from '../../schema'

export function Log() {
  const [rsvpRows, setRsvpRows] = useState<AdminRsvpResponseLogRow[]>([])
  const [guestRows, setGuestRows] = useState<AdminGuestResponseLogRow[]>([])
  const [guestCustomFields, setGuestCustomFields] = useState<
    CustomFieldConfig[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [r, g] = await Promise.all([
          listRsvpResponseLog(),
          listGuestResponseLog(),
        ])
        setRsvpRows(r.rows)
        setGuestRows(g.rows)
        setGuestCustomFields(g.guestCustomFields)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <LoadingIndicator />
  if (error) return <ErrorMessage>{error}</ErrorMessage>

  return (
    <div className={styles.page}>
      <PageHeader title="RSVP responses" />
      <Table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Guest</th>
            <th>Event</th>
            <th>Status</th>
            <th>Responded by</th>
            <th className={guestListStyles.customDivider}>Custom answers</th>
          </tr>
        </thead>
        <tbody>
          {rsvpRows.length === 0 && (
            <tr>
              <td colSpan={6} className={guestListStyles.muted}>
                No RSVP responses yet.
              </td>
            </tr>
          )}
          {rsvpRows.map((row) => {
            const answers = formatCustomAnswers(
              row.eventCustomFields,
              row.notesJson
            )
            return (
              <tr key={row.id}>
                <td>{new Date(row.respondedAt).toLocaleString()}</td>
                <td>{row.guestName}</td>
                <td>{row.eventName}</td>
                <td>{row.status}</td>
                <td>{row.respondedByDisplayName ?? '—'}</td>
                <td className={guestListStyles.customDivider}>
                  {answers.length === 0 ? (
                    '—'
                  ) : (
                    <div className={guestListStyles.customCell}>
                      {answers.map((a) => (
                        <span key={a.label}>
                          <span className={guestListStyles.customLabel}>
                            {a.label}:
                          </span>
                          {a.value}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>

      <PageHeader title="Guest responses" />
      <Table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Guest</th>
            <th>Notes</th>
            <th>Responded by</th>
            {guestCustomFields.map((f, i) => (
              <th
                key={f.id}
                className={i === 0 ? guestListStyles.customDivider : undefined}
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guestRows.length === 0 && (
            <tr>
              <td
                colSpan={4 + guestCustomFields.length}
                className={guestListStyles.muted}
              >
                No guest responses yet.
              </td>
            </tr>
          )}
          {guestRows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.respondedAt).toLocaleString()}</td>
              <td>{row.guestName}</td>
              <td>{row.notes ?? '—'}</td>
              <td>{row.respondedByDisplayName ?? '—'}</td>
              {guestCustomFields.map((f, i) => (
                <td
                  key={f.id}
                  className={
                    i === 0 ? guestListStyles.customDivider : undefined
                  }
                >
                  {renderCustomFieldValue(f, row.notesJson) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
