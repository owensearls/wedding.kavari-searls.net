import {
  fieldsInOrder,
  parseNotesSchema,
  type NotesJson,
  type NotesJsonSchema,
} from 'db'
import type { AdminFieldDraft } from '../../schema'

// Parse the JSON in a notes_json column. Returns an empty object for null,
// empty strings, or anything that doesn't decode to an object.
export function parseNotesJson(raw: string | null): NotesJson {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Parse a notes_schema column defensively. Returns null on any parse error
// or structural mismatch so downstream renderers can treat the row as "no
// custom fields" instead of crashing.
export function safeParseNotesSchema(
  raw: string | null
): NotesJsonSchema | null {
  let parsed: unknown
  try {
    parsed = parseNotesSchema(raw)
  } catch {
    return null
  }
  if (parsed === null) return null
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const s = parsed as Partial<NotesJsonSchema>
  if (s.type !== 'object') return null
  if (!Array.isArray(s['x-fieldOrder'])) return null
  if (!s.properties || typeof s.properties !== 'object') return null
  return parsed as NotesJsonSchema
}

export function schemaToDrafts(
  schema: NotesJsonSchema | null
): AdminFieldDraft[] {
  if (!schema) return []
  return fieldsInOrder(schema).map(({ key, field }) => ({ key, field }))
}

export function draftsToSchema(
  drafts: AdminFieldDraft[]
): NotesJsonSchema | null {
  if (drafts.length === 0) return null
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    'x-fieldOrder': drafts.map((d) => d.key),
    properties: Object.fromEntries(drafts.map((d) => [d.key, d.field])),
  }
}
