'use client'

import Papa from 'papaparse'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EditFormSection } from '../../components/ui/EditFormSection'
import { EditFormShell } from '../../components/ui/EditFormShell'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { SectionLabel } from '../../components/ui/SectionLabel'
import { Table } from '../../components/ui/Table'
import { listEvents, type AdminEventRecord } from '../../server/admin/events'
import { importRows, type ImportResult } from '../../server/admin/import'
import styles from './Import.module.css'

const EXAMPLE = `groupLabel,firstName,lastName,email,phone,events
The Smith family,Alice,Smith,alice@example.com,,"ceremony,reception"
The Smith family,Bob,Smith,,,"ceremony,reception"
The Smith family,Charlie,Smith,,,ceremony
Jordan & guest,Jordan,Lee,jordan@example.com,,"ceremony,reception"
Jordan & guest,Plus,one,,,reception`

export function Import() {
  const [csv, setCsv] = useState('')
  const [keepLabels, setKeepLabels] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [events, setEvents] = useState<AdminEventRecord[]>([])

  useEffect(() => {
    listEvents()
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]))
  }, [])

  const eventBySlug = useMemo(
    () => new Map(events.map((e) => [e.slug, e])),
    [events]
  )

  const preview = useMemo(() => {
    if (!csv.trim()) return null
    return Papa.parse<Record<string, string>>(csv.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      transform: (v) => v.trim(),
    })
  }, [csv])

  const unknownSlugs = useMemo(() => {
    if (!preview || events.length === 0) return []
    const known = new Set(events.map((e) => e.slug))
    const unknown = new Set<string>()
    for (const row of preview.data) {
      const cell = row['events']
      if (!cell) continue
      for (const slug of cell
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        if (!known.has(slug)) unknown.add(slug)
      }
    }
    return Array.from(unknown).sort()
  }, [preview, events])

  async function onSubmit() {
    if (!preview || preview.errors.length > 0) {
      setError('Fix the CSV before submitting.')
      return
    }
    if (unknownSlugs.length > 0) {
      setError(
        `Unknown event slug${unknownSlugs.length === 1 ? '' : 's'}: ${unknownSlugs.join(', ')}. Fix the CSV or add the event.`
      )
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await importRows(preview.data, { keepLabels })
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
    <EditFormShell
      title="Import guests"
      onBack={() => {
        window.location.assign('/admin/')
      }}
    >
      <EditFormSection>
        <p className={styles.helper}>
          Paste a CSV. Columns: <code>groupLabel</code>, <code>firstName</code>,{' '}
          <code>lastName</code>, <code>email</code>, <code>phone</code>,{' '}
          <code>events</code> (comma-separated event slugs). Existing invites
          (matched by label) are skipped. Rows with an empty{' '}
          <code>groupLabel</code> are imported as solo invites.
        </p>
        <textarea
          className="admin-textarea"
          rows={10}
          value={csv}
          placeholder={EXAMPLE}
          onChange={(e) => setCsv(e.target.value)}
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={keepLabels}
            onChange={(e) => setKeepLabels(e.target.checked)}
          />
          Save group labels (used to identify parties in the admin UI). When
          off, labels group rows during import only and aren't stored.
        </label>
        <div className={styles.row}>
          <Button
            onClick={onSubmit}
            disabled={submitting || !csv.trim() || unknownSlugs.length > 0}
          >
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
          {unknownSlugs.length > 0 && (
            <ErrorMessage>
              {`Unknown event slug${unknownSlugs.length === 1 ? '' : 's'}: ${unknownSlugs.join(', ')}. Import is disabled until these are removed from the CSV or added as events.`}
            </ErrorMessage>
          )}
          <Table>
            <thead>
              <tr>
                {previewColumns.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.data.map((row, i) => (
                <tr key={i}>
                  {previewColumns.map((k) => (
                    <td key={k}>
                      {k === 'events' ? (
                        <EventChips
                          value={row[k] ?? ''}
                          eventBySlug={eventBySlug}
                        />
                      ) : (
                        (row[k] ?? '')
                      )}
                    </td>
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
                      <td>
                        {c.label ??
                          (c.guests.length === 1 ? (
                            <em>(solo)</em>
                          ) : (
                            <em>(no label)</em>
                          ))}
                      </td>
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

function EventChips({
  value,
  eventBySlug,
}: {
  value: string
  eventBySlug: Map<string, AdminEventRecord>
}) {
  const slugs = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (slugs.length === 0) return null
  return (
    <span className={styles.chips}>
      {slugs.map((slug) => {
        const event = eventBySlug.get(slug)
        return (
          <span
            key={slug}
            className={`${styles.chip} ${event ? styles.chipKnown : styles.chipUnknown}`}
            title={event ? slug : `Unknown event slug: ${slug}`}
          >
            {event ? event.name : slug}
          </span>
        )
      })}
    </span>
  )
}
