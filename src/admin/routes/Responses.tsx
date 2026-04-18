import { useEffect, useState } from 'react'
import { listResponses } from '../api'
import type { AdminResponseRow } from '@shared/schemas/admin'
import styles from '../AdminApp.module.css'

function Responses() {
  const [rows, setRows] = useState<AdminResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listResponses()
      .then((r) => setRows(r.rows))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load'),
      )
      .finally(() => setLoading(false))
  }, [])

  function exportCsv() {
    const header = [
      'groupLabel',
      'inviteCode',
      'guestName',
      'eventName',
      'status',
      'mealLabel',
      'dietaryRestrictions',
      'respondedAt',
    ]
    const escape = (v: string | null) =>
      v === null ? '' : `"${v.replace(/"/g, '""')}"`
    const csv = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.groupLabel,
          r.inviteCode,
          r.guestName,
          r.eventName,
          r.status,
          r.mealLabel,
          r.dietaryRestrictions,
          r.respondedAt,
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rsvp-responses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className={`${styles.row} ${styles.card}`}>
        <h2 style={{ margin: 0, flex: 1 }}>Responses</h2>
        <button
          type="button"
          className="admin-button"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          Export CSV
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Group</th>
                <th>Guest</th>
                <th>Event</th>
                <th>Status</th>
                <th>Meal</th>
                <th>Dietary</th>
                <th>Responded</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    No invitations yet.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.groupLabel}</td>
                  <td>{r.guestName}</td>
                  <td>{r.eventName}</td>
                  <td>{r.status}</td>
                  <td>{r.mealLabel ?? ''}</td>
                  <td>{r.dietaryRestrictions ?? ''}</td>
                  <td>{r.respondedAt ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Responses
