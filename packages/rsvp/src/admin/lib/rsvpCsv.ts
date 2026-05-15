import type { AdminResponseRow } from '../../schema'

const HEADER = [
  'groupLabel',
  'inviteCode',
  'guestName',
  'eventName',
  'status',
  'customAnswers',
  'notes',
  'respondedAt',
] as const

function escapeCsv(v: string | null): string {
  return v === null ? '' : `"${v.replace(/"/g, '""')}"`
}

export function responsesToCsv(rows: AdminResponseRow[]): string {
  return [
    HEADER.join(','),
    ...rows.map((r) =>
      [
        r.groupLabel,
        r.inviteCode,
        r.guestName,
        r.eventName,
        r.status,
        r.customAnswers,
        r.notes,
        r.respondedAt,
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ].join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
