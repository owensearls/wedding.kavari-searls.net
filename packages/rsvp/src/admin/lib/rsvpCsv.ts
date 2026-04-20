import type { AdminResponseRow } from 'schema/admin'

const HEADER = [
  'groupLabel',
  'inviteCode',
  'guestName',
  'eventName',
  'status',
  'mealLabel',
  'dietaryRestrictions',
  'respondedAt',
] as const

function escapeCsv(v: string | null): string {
  return v === null ? '' : `"${v.replace(/"/g, '""')}"`
}

// Turn admin response rows into a CSV string that mirrors the column order
// clients expect (old Responses page).
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
        r.mealLabel,
        r.dietaryRestrictions,
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
