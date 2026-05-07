// Bidirectional helpers between the ISO strings we store/send and the
// `YYYY-MM-DDTHH:MM` values that a `<input type="datetime-local">` expects.
// We store wall-clock ISO strings like `2026-09-19T16:00:00` so the browser
// parses them as local time and the admin can enter events without fighting
// with timezones.

const pad = (n: number) => String(n).padStart(2, '0')

export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToIso(v: string): string | null {
  if (!v) return null
  const trimmed = v.slice(0, 16)
  return trimmed.length === 16 ? `${trimmed}:00` : null
}

export function formatForDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
