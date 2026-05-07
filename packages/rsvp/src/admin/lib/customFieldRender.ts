import {
  fieldsInOrder,
  findOption,
  isShortTextField,
  isSingleSelectField,
  type NotesFieldSchema,
  type NotesJson,
  type NotesJsonSchema,
} from 'db'

export function renderFieldValue(
  field: NotesFieldSchema,
  raw: string | null | undefined
): string {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (isShortTextField(field)) return raw
  if (isSingleSelectField(field)) {
    const opt = findOption(field, raw)
    return opt ? opt.title : `${raw} (legacy)`
  }
  return String(raw)
}

export function formatCustomAnswers(
  schema: NotesJsonSchema | null,
  notesJson: NotesJson
): Array<{ label: string; value: string }> {
  if (!schema) return []
  const out: Array<{ label: string; value: string }> = []
  for (const { key, field } of fieldsInOrder(schema)) {
    const raw = notesJson[key]
    if (raw === null || raw === undefined || raw === '') continue
    out.push({ label: field.title, value: renderFieldValue(field, raw) })
  }
  return out
}
