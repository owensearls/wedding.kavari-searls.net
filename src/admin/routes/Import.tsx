'use client'

import Papa from 'papaparse'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { EditFormSection } from '../../components/ui/EditFormSection'
import { EditFormShell } from '../../components/ui/EditFormShell'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { SectionLabel } from '../../components/ui/SectionLabel'
import { Table } from '../../components/ui/Table'
import { importRows, type ImportResult } from '../api'
import styles from './Import.module.css'

const EXAMPLE = `groupLabel,firstName,lastName,email,phone,events
The Smith family,Alice,Smith,alice@example.com,,"ceremony,reception"
The Smith family,Bob,Smith,,,"ceremony,reception"
The Smith family,Charlie,Smith,,,ceremony
Jordan & guest,Jordan,Lee,jordan@example.com,,"ceremony,reception"
Jordan & guest,Plus,one,,,reception`

export function Import() {
  const navigate = useNavigate()
  const [csv, setCsv] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const preview = useMemo(() => {
    if (!csv.trim()) return null
    return Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
    })
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

  const previewColumns =
    preview && preview.data.length > 0 ? Object.keys(preview.data[0] ?? {}) : []

  return (
    <EditFormShell title="Import guests" onBack={() => navigate('/admin/groups')}>
      <EditFormSection>
        <p className={styles.helper}>
          Paste a CSV. Columns: <code>groupLabel</code>, <code>firstName</code>,{' '}
          <code>lastName</code>, <code>email</code>, <code>phone</code>,{' '}
          <code>events</code> (comma-separated event slugs). Existing invites
          (matched by label) are skipped.
        </p>
        <textarea
          className="admin-textarea"
          rows={10}
          value={csv}
          placeholder={EXAMPLE}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className={styles.row}>
          <Button onClick={onSubmit} disabled={submitting || !csv.trim()}>
            {submitting ? 'Importing…' : 'Import'}
          </Button>
          <Button variant="ghost" onClick={() => setCsv(EXAMPLE)}>
            Load example
          </Button>
        </div>
        <ErrorMessage variant="inline">{error}</ErrorMessage>
      </EditFormSection>

      {preview && preview.data.length > 0 && (
        <EditFormSection>
          <SectionLabel>Preview ({preview.data.length} rows)</SectionLabel>
          <ErrorMessage>
            {preview.errors.length > 0
              ? `CSV parse errors: ${preview.errors
                  .map((e) => e.message)
                  .join('; ')}`
              : null}
          </ErrorMessage>
          <Table>
            <thead>
              <tr>
                {previewColumns.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.data.slice(0, 50).map((row, i) => (
                <tr key={i}>
                  {previewColumns.map((k) => (
                    <td key={k}>{row[k] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </EditFormSection>
      )}

      {result && (
        <EditFormSection>
          <SectionLabel>Result</SectionLabel>
          <p>Created {result.created.length} invites.</p>
          {result.skipped.length > 0 && (
            <p>Skipped (label already existed): {result.skipped.join(', ')}</p>
          )}
          {result.created.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <th>Label</th>
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
                  ))
                )}
              </tbody>
            </Table>
          )}
        </EditFormSection>
      )}
    </EditFormShell>
  )
}
