'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import {
  GroupedList,
  GroupedListBlock,
  GroupedListEmptyBlock,
  GroupedListHeaderCell,
  GroupedListHeaderRow,
} from '../../components/ui/GroupedList'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import { listLog, type AdminLogRow } from '../../server/admin/responses'
import { formatCustomAnswers } from '../lib/customFieldRender'
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
    let cancelled = false
    listLog()
      .then((r) => {
        if (!cancelled) setRows(r.rows)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.page}>
      <PageHeader title="Activity log" />
      <ErrorMessage>{error}</ErrorMessage>
      <GroupedList className={styles.list} ariaLabel="Activity log">
        <GroupedListHeaderRow>
          <GroupedListHeaderCell gutter>Guest response</GroupedListHeaderCell>
          <GroupedListHeaderCell>Event</GroupedListHeaderCell>
          <GroupedListHeaderCell>Status</GroupedListHeaderCell>
          <GroupedListHeaderCell>Answers</GroupedListHeaderCell>
        </GroupedListHeaderRow>

        {loading ? (
          <>
            {[2, 1, 2].map((rowCount, i) => (
              <LoadingBlock key={i} rowCount={rowCount} />
            ))}
          </>
        ) : rows.length === 0 ? (
          <GroupedListEmptyBlock>No activity yet.</GroupedListEmptyBlock>
        ) : (
          rows.map((row) => <ResponseBlock key={row.id} row={row} />)
        )}
      </GroupedList>
    </div>
  )
}

function ResponseBlock({ row }: { row: AdminLogRow }) {
  const ts = formatTimestamp(row.respondedAt)
  const inviteAnswers = formatCustomAnswers(
    row.invitationNotesSchema,
    row.notesJson
  )
  const rowSpan = Math.max(row.events.length, 1)
  const isSolo = rowSpan === 1
  return (
    <GroupedListBlock
      solo={isSolo}
      rowSpan={rowSpan}
      gutter={
        <div className={styles.gutterBody}>
          <div className={styles.gutterHeader}>
            <span className={styles.guestName}>{row.guestName}</span>
            <span className={styles.timestamp} title={row.respondedAt}>
              <span className={styles.timestampDate}>{ts.date}</span>
              <span className={styles.timestampDot} aria-hidden>
                ·
              </span>
              <span className={styles.timestampTime}>{ts.time}</span>
            </span>
          </div>
          {inviteAnswers.length > 0 && (
            <div className={styles.gutterAnswers}>
              {inviteAnswers.map((a) => (
                <span key={a.label} className={styles.answerChip}>
                  <span className={styles.customLabel}>{a.label}:</span>
                  {a.value}
                </span>
              ))}
            </div>
          )}
          <div className={styles.gutterByline}>
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
      }
    >
      {row.events.length === 0 ? (
        <div className={styles.eventRow}>
          <div className={styles.noEvents}>No event responses recorded.</div>
        </div>
      ) : (
        row.events.map((e) => {
          const eventAnswers = formatCustomAnswers(
            e.eventNotesSchema,
            e.notesJson
          )
          return (
            <div key={e.eventId} className={styles.eventRow}>
              <div className={styles.eventCell}>{e.eventName}</div>
              <div
                className={`${styles.statusCell} ${statusClassName(e.status)}`}
              >
                <StatusBadge status={e.status} />
              </div>
              <div className={styles.answersCell}>
                {eventAnswers.length === 0 ? (
                  <span className={styles.dash}>—</span>
                ) : (
                  <div className={styles.answersList}>
                    {eventAnswers.map((a) => (
                      <span key={a.label} className={styles.answerChip}>
                        <span className={styles.customLabel}>{a.label}:</span>
                        {a.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </GroupedListBlock>
  )
}

function LoadingBlock({ rowCount }: { rowCount: number }) {
  const isSolo = rowCount === 1
  return (
    <GroupedListBlock
      solo={isSolo}
      rowSpan={rowCount}
      ariaHidden
      gutter={
        <div className={styles.gutterBody}>
          <div className={styles.gutterHeader}>
            <div className={`${styles.loadingBar} ${styles.loadingBarName}`} />
            <div className={`${styles.loadingBar} ${styles.loadingBarMeta}`} />
          </div>
          <div className={styles.gutterByline}>
            <div className={`${styles.loadingBar} ${styles.loadingBarMeta}`} />
          </div>
        </div>
      }
    >
      {Array.from({ length: rowCount }, (_, i) => (
        <div
          key={i}
          className={`${styles.eventRow} ${styles.eventRowStatic}`}
          aria-hidden="true"
        >
          <div className={styles.loadingRowCell}>
            <div className={styles.loadingBar} />
          </div>
        </div>
      ))}
    </GroupedListBlock>
  )
}
