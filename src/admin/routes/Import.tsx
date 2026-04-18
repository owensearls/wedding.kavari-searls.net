import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { importRows, type ImportResult } from '../api'
import styles from '../AdminApp.module.css'

const EXAMPLE = `groupLabel,firstName,lastName,email,phone,events
The Smith family,Alice,Smith,alice@example.com,,"ceremony,reception"
The Smith family,Bob,Smith,,,"ceremony,reception"
The Smith family,Charlie,Smith,,,ceremony
Jordan & guest,Jordan,Lee,jordan@example.com,,"ceremony,reception"
Jordan & guest,Plus,one,,,reception`

function Import() {
  const [csv, setCsv] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const preview = useMemo(() => {
    if (!csv.trim()) return null
    const parsed = Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
    })
    return parsed
  }, [csv])

  async function onSubmit() {
    if (!preview || preview.errors.length > 0) {
      setError('Fix the CSV before submitting.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await importRows(preview.data)
      setResult(res)
      setCsv('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className={styles.card}>
        <h2 style={{ marginTop: 0 }}>Import guests</h2>
        <p className={styles.muted}>
          Paste a CSV. Columns: <code>groupLabel</code>, <code>firstName</code>,{' '}
          <code>lastName</code>, <code>email</code>, <code>phone</code>,{' '}
          <code>events</code> (comma-separated event slugs). Existing groups
          (matched by label) are skipped.
        </p>
        <textarea
          className="admin-textarea"
          rows={10}
          value={csv}
          placeholder={EXAMPLE}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className={styles.row} style={{ marginTop: 12 }}>
          <button
            type="button"
            className="admin-button"
            onClick={onSubmit}
            disabled={submitting || !csv.trim()}
          >
            {submitting ? 'Importing…' : 'Import'}
          </button>
          <button
            type="button"
            className="admin-button ghost"
            onClick={() => setCsv(EXAMPLE)}
          >
            Load example
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {preview && preview.data.length > 0 && (
        <div className={styles.card}>
          <h3 style={{ marginTop: 0 }}>Preview ({preview.data.length} rows)</h3>
          {preview.errors.length > 0 && (
            <p className={styles.error}>
              CSV parse errors: {preview.errors.map((e) => e.message).join('; ')}
            </p>
          )}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {Object.keys(preview.data[0] ?? {}).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    {Object.keys(preview.data[0] ?? {}).map((k) => (
                      <td key={k}>{row[k] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className={styles.card}>
          <h3 style={{ marginTop: 0 }}>Result</h3>
          <p>Created {result.created.length} groups.</p>
          {result.skipped.length > 0 && (
            <p>
              Skipped (label already existed): {result.skipped.join(', ')}
            </p>
          )}
          {result.created.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Guest</th>
                    <th>Invite code</th>
                  </tr>
                </thead>
                <tbody>
                  {result.created.flatMap((c) =>
                    c.guests.map((g) => (
                      <tr key={g.id}>
                        <td>{c.label}</td>
                        <td>{g.displayName}</td>
                        <td>
                          <code>{g.inviteCode}</code>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Import
