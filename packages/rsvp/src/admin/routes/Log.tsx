'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import { Table } from '../../components/ui/Table'
import { listLog, type AdminLogRow } from '../../server/admin/responses'
import { formatCustomAnswers } from '../lib/customFieldRender'
import guestListStyles from './GuestList.module.css'
import styles from './Log.module.css'

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
            <th>Guest</th>
            <th>Events</th>
            <th className={guestListStyles.customDivider}>
              Invite-level answers
            </th>
            <th>Responded by</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className={guestListStyles.muted}>
                No activity yet.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const inviteAnswers = formatCustomAnswers(
              row.invitationNotesSchema,
              row.notesJson
            )
            return (
              <tr key={row.id}>
                <td>{new Date(row.respondedAt).toLocaleString()}</td>
                <td>{row.guestName}</td>
                <td>
                  {row.events.length === 0 ? (
                    '—'
                  ) : (
                    <div className={styles.eventList}>
                      {row.events.map((e) => {
                        const eventAnswers = formatCustomAnswers(
                          e.eventNotesSchema,
                          e.notesJson
                        )
                        return (
                          <div key={e.eventId} className={styles.eventEntry}>
                            <span className={styles.eventName}>
                              {e.eventName}
                            </span>{' '}
                            <span className={statusClassName(e.status)}>
                              <StatusBadge status={e.status} />
                            </span>
                            {eventAnswers.length > 0 && (
                              <div className={styles.eventAnswers}>
                                {eventAnswers.map((a) => (
                                  <span key={a.label}>
                                    <span
                                      className={guestListStyles.customLabel}
                                    >
                                      {a.label}:
                                    </span>
                                    {a.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </td>
                <td className={guestListStyles.customDivider}>
                  {inviteAnswers.length === 0 ? (
                    '—'
                  ) : (
                    <div className={guestListStyles.customCell}>
                      {inviteAnswers.map((a) => (
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
