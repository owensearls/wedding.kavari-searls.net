'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { Table } from '../../components/ui/Table'
import { listLog, type AdminLogRow } from '../../server/admin/responses'
import { formatCustomAnswers } from '../lib/customFieldRender'
import guestListStyles from './GuestList.module.css'
import styles from './Log.module.css'

function typeLabel(kind: AdminLogRow['kind']): string {
  return kind === 'rsvp' ? 'RSVP' : 'Guest profile'
}

export function Log() {
  const [rows, setRows] = useState<AdminLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const r = await listLog()
        setRows(r.rows)
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
      <PageHeader title="Activity log" />
      <Table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Guest</th>
            <th>Subject</th>
            <th>Status / Notes</th>
            <th className={guestListStyles.customDivider}>Custom answers</th>
            <th>Responded by</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className={guestListStyles.muted}>
                No activity yet.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const answers = formatCustomAnswers(row.notesSchema, row.notesJson)
            const statusOrNotes =
              row.kind === 'rsvp' ? (row.status ?? '—') : (row.notes ?? '—')
            return (
              <tr key={`${row.kind}-${row.id}`}>
                <td>{new Date(row.respondedAt).toLocaleString()}</td>
                <td>{typeLabel(row.kind)}</td>
                <td>{row.guestName}</td>
                <td>{row.subject ?? '—'}</td>
                <td>{statusOrNotes}</td>
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
                <td>{row.respondedByDisplayName ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </div>
  )
}
