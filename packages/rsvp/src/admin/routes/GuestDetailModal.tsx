'use client'

import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import { Table } from '../../components/ui/Table'
import { getGuest } from '../../server/admin/guests'
import {
  formatCustomAnswers,
  renderCustomFieldValue,
} from '../lib/customFieldRender'
import styles from './GuestList.module.css'
import type { AdminGuestDetail, CustomFieldConfig } from '../../schema'

type GuestDetailWithFields = AdminGuestDetail & {
  guestCustomFields: CustomFieldConfig[]
  eventCustomFieldsByEvent: Record<string, CustomFieldConfig[]>
}

interface GuestDetailModalProps {
  guestId: string
  onClose: () => void
}

export function GuestDetailModal({ guestId, onClose }: GuestDetailModalProps) {
  const [data, setData] = useState<GuestDetailWithFields | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGuest(guestId)
      .then((d) => {
        if (!cancelled) setData(d as GuestDetailWithFields)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [guestId])

  const title = data?.displayName ?? 'Guest details'

  return (
    <Modal title={title} onClose={onClose}>
      <ErrorMessage>{error}</ErrorMessage>
      {!data && !error && <LoadingIndicator variant="inline" />}
      {data && (
        <>
          <div className={styles.detailGrid}>
            <div className={styles.detailLabel}>Group</div>
            <div>{data.groupLabel}</div>
            <div className={styles.detailLabel}>Invite code</div>
            <div>
              <a
                href={`${import.meta.env.VITE_FRONTEND_URL}/rsvp/${encodeURIComponent(data.inviteCode)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.codeLink}
              >
                {data.inviteCode}
              </a>
            </div>
            {data.email && (
              <>
                <div className={styles.detailLabel}>Email</div>
                <div>{data.email}</div>
              </>
            )}
            {data.phone && (
              <>
                <div className={styles.detailLabel}>Phone</div>
                <div>{data.phone}</div>
              </>
            )}
            {data.notes && (
              <>
                <div className={styles.detailLabel}>Notes</div>
                <div>{data.notes}</div>
              </>
            )}
          </div>

          {data.guestCustomFields.length > 0 && (
            <div
              className={`${styles.detailGrid} ${styles.customDivider}`}
              style={{ marginTop: 12, paddingLeft: 12 }}
            >
              {data.guestCustomFields.map((f) => {
                const v = renderCustomFieldValue(f, data.notesJson)
                return (
                  <div key={f.id} style={{ display: 'contents' }}>
                    <div className={styles.detailLabel}>{f.label}</div>
                    <div>{v ?? '—'}</div>
                  </div>
                )
              })}
            </div>
          )}

          <h3 className={styles.detailSubheading}>Events</h3>
          <Table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Responded</th>
                <th>By</th>
                <th className={styles.customDivider}>Custom answers</th>
              </tr>
            </thead>
            <tbody>
              {data.events.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.muted}>
                    Not invited to any events yet.
                  </td>
                </tr>
              )}
              {data.events.map((e) => {
                const fields = data.eventCustomFieldsByEvent[e.eventId] ?? []
                const answers = formatCustomAnswers(fields, e.notesJson)
                return (
                  <tr key={e.eventId}>
                    <td>{e.eventName}</td>
                    <td className={statusClassName(e.status)}>
                      <StatusBadge status={e.status} />
                    </td>
                    <td>
                      {e.respondedAt
                        ? new Date(e.respondedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td>{e.respondedByDisplayName ?? '—'}</td>
                    <td className={styles.customDivider}>
                      {answers.length === 0 ? (
                        '—'
                      ) : (
                        <div className={styles.customCell}>
                          {answers.map((a) => (
                            <span key={a.label}>
                              <span className={styles.customLabel}>
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
        </>
      )}
    </Modal>
  )
}
