import type {
  AdminEventInput,
  AdminGroupInput,
  AdminGroupListItem,
  AdminGuestDetail,
  AdminResponseRow,
} from '@shared/schemas/admin'

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
      (body as { error?: string } | null)?.error ??
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}

export function listGroups() {
  return jsonRequest<{ groups: AdminGroupListItem[] }>('/api/admin/groups')
}

export function saveGroup(input: AdminGroupInput) {
  return jsonRequest<{ id: string }>('/api/admin/groups', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deleteGroup(id: string) {
  return jsonRequest<{ ok: true }>(
    `/api/admin/groups/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

export function getGroup(id: string) {
  return jsonRequest<AdminGroupInput & { id: string }>(
    `/api/admin/groups/${encodeURIComponent(id)}`,
  )
}

export function getGuest(id: string) {
  return jsonRequest<AdminGuestDetail>(
    `/api/admin/guests/${encodeURIComponent(id)}`,
  )
}

export interface AdminEventRecord extends AdminEventInput {
  id: string
}

export function listEvents() {
  return jsonRequest<{ events: AdminEventRecord[] }>('/api/admin/events')
}

export function saveEvent(input: AdminEventInput) {
  return jsonRequest<{ id: string }>('/api/admin/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listResponses() {
  return jsonRequest<{ rows: AdminResponseRow[] }>('/api/admin/responses')
}

export interface ImportResult {
  created: {
    groupId: string
    label: string
    guests: { id: string; displayName: string; inviteCode: string }[]
  }[]
  skipped: string[]
}

export function importRows(rows: unknown[]) {
  return jsonRequest<ImportResult>('/api/admin/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}
