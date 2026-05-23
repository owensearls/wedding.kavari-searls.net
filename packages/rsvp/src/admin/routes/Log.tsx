'use client'

import { Fragment, useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import {
  Table,
  TableEmptyRow,
  TableSkeletonRows,
} from '../../components/ui/Table'
import { listLog, type AdminLogRow } from '../../server/admin/responses'
import { formatCustomAnswers } from '../lib/customFieldRender'
import guestListStyles from './GuestList.module.css'
import styles from './Log.module.css'

const TIMESTAMP_FMT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  // Intl returns e.g. "May 18, 2026, 14:32:01"; split on the last comma so
  // we can stack the date and time visually.
  const parts = TIMESTAMP_FMT.format(d).split(', ')
  if (parts.length < 3) return { date: parts.join(', '), time: '' }
  return {
    date: parts.slice(0, 2).join(', '),
    time: parts.slice(2).join(', '),
  }
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

  return (
    <div className={styles.page}>
      <PageHeader title="Activity log" />
      <ErrorMessage>{error}</ErrorMessage>
      <Table>
        <colgroup>
          <col className={styles.colEvent} />
          <col className={styles.colStatus} />
          <col className={styles.colAnswers} />
        </colgroup>
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th>Answers</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSkeletonRows colSpan={3} />
          ) : rows.length === 0 ? (
            <TableEmptyRow colSpan={3}>No activity yet.</TableEmptyRow>
          ) : (
            rows.map((row) => {
              const inviteAnswers = formatCustomAnswers(
                row.invitationNotesSchema,
                row.notesJson
              )
              const ts = formatTimestamp(row.respondedAt)
              return (
                <Fragment key={row.id}>
                  <tr className={styles.bannerRow}>
                    <td colSpan={3}>
                      <div className={styles.bannerTop}>
                        <span className={styles.guestName}>
                          {row.guestName}
                        </span>
                        <span
                          className={styles.timestamp}
                          title={row.respondedAt}
                        >
                          <span className={styles.timestampDate}>
                            {ts.date}
                          </span>
                          <span className={styles.timestampDot} aria-hidden>
                            ·
                          </span>
                          <span className={styles.timestampTime}>
                            {ts.time}
                          </span>
                        </span>
                      </div>
                      {(inviteAnswers.length > 0 ||
                        row.respondedByDisplayName) && (
                        <div className={styles.bannerMeta}>
                          {inviteAnswers.length > 0 && (
                            <div className={styles.bannerAnswers}>
                              {inviteAnswers.map((a) => (
                                <span
                                  key={a.label}
                                  className={styles.answerChip}
                                >
                                  <span className={guestListStyles.customLabel}>
                                    {a.label}:
                                  </span>
                                  {a.value}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className={styles.bannerByline}>
                            {row.respondedByDisplayName && (
                              <span className={styles.respondedBy}>
                                <span className={styles.bylineLabel}>by</span>{' '}
                                {row.respondedByDisplayName}
                              </span>
                            )}
                            <span className={styles.responseId} title={row.id}>
                              #{row.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                  {row.events.length === 0 ? (
                    <tr className={styles.eventRow}>
                      <td colSpan={3} className={styles.noEvents}>
                        No event responses recorded.
                      </td>
                    </tr>
                  ) : (
                    row.events.map((e) => {
                      const eventAnswers = formatCustomAnswers(
                        e.eventNotesSchema,
                        e.notesJson
                      )
                      return (
                        <tr
                          key={`${row.id}-${e.eventId}`}
                          className={styles.eventRow}
                        >
                          <td className={styles.eventCell}>
                            <span className={styles.eventName}>
                              {e.eventName}
                            </span>
                          </td>
                          <td className={statusClassName(e.status)}>
                            <StatusBadge status={e.status} />
                          </td>
                          <td className={styles.answersCell}>
                            {eventAnswers.length === 0 ? (
                              <span className={styles.dash}>—</span>
                            ) : (
                              <div className={styles.answersList}>
                                {eventAnswers.map((a) => (
                                  <span
                                    key={a.label}
                                    className={styles.answerChip}
                                  >
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
                          </td>
                        </tr>
                      )
                    })
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </Table>
    </div>
  )
}
