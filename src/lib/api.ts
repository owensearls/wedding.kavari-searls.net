import type {
  LookupResponse,
  RsvpGroupResponse,
  RsvpSubmission,
} from '@shared/schemas/rsvp'

async function jsonRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Bad JSON response (status ${res.status})`)
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}

export function rsvpLookup(query: string) {
  const url = `/api/rsvp/lookup?query=${encodeURIComponent(query)}`
  return jsonRequest<LookupResponse>(url, { method: 'GET' })
}

export function rsvpGroupGet(code: string) {
  return jsonRequest<RsvpGroupResponse>(
    `/api/rsvp/${encodeURIComponent(code)}`,
    { method: 'GET' },
  )
}

export function rsvpGroupSubmit(code: string, submission: RsvpSubmission) {
  return jsonRequest<{ ok: true; respondedAt: string }>(
    `/api/rsvp/${encodeURIComponent(code)}`,
    {
      method: 'POST',
      body: JSON.stringify(submission),
    },
  )
}
