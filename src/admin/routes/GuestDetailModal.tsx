import { useEffect, useState } from 'react'
import ErrorMessage from '../../components/ui/ErrorMessage'
import LoadingIndicator from '../../components/ui/LoadingIndicator'
import Modal from '../../components/ui/Modal'
import StatusBadge from '../../components/ui/StatusBadge'
import { statusClassName } from '../../components/ui/statusHelpers'
import Table from '../../components/ui/Table'
import { getGuest } from '../api'
import styles from './GuestList.module.css'
import type { AdminGuestDetail } from '@shared/schemas/admin'

interface GuestDetailModalProps {
  guestId: string
  onClose: () => void
}

// Click-in submission detail for a single guest. Fetches its own data and
// shows a spinner until it resolves; the caller should key={guestId} when
// swapping targets so we get a clean re-mount and avoid flash of stale data.
function GuestDetailModal({ guestId, onClose }: GuestDetailModalProps) {
  const [data, setData] = useState<AdminGuestDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getGuest(guestId)
      .then((d) => {
        if (!cancelled) setData(d)
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
                href={`/rsvp/${encodeURIComponent(data.inviteCode)}`}
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
            {data.dietaryRestrictions && (
              <>
                <div className={styles.detailLabel}>Dietary</div>
                <div>{data.dietaryRestrictions}</div>
              </>
            )}
            {data.notes && (
              <>
                <div className={styles.detailLabel}>Notes</div>
                <div>{data.notes}</div>
              </>
            )}
          </div>

          <h3 className={styles.detailSubheading}>Events</h3>
          <Table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Meal</th>
                <th>Responded</th>
                <th>By</th>
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
              {data.events.map((e) => (
                <tr key={e.eventId}>
                  <td>{e.eventName}</td>
                  <td className={statusClassName(e.status)}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td>{e.mealLabel ?? '—'}</td>
                  <td>
                    {e.respondedAt
                      ? new Date(e.respondedAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>{e.respondedByDisplayName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {data.notesJson?.songRequest && (
            <>
              <h3 className={styles.detailSubheading}>Song request</h3>
              <p>
                {data.notesJson.songRequest.title}
                {data.notesJson.songRequest.artist
                  ? ` — ${data.notesJson.songRequest.artist}`
                  : ''}
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

export default GuestDetailModal
