import type { CustomFieldConfig } from '../../schema'

export function buildOptionLabelMap(
  fields: CustomFieldConfig[]
): Map<string, string> {
  const out = new Map<string, string>()
  for (const f of fields) {
    if (f.type !== 'single_select') continue
    for (const o of f.options) out.set(o.id, o.label)
  }
  return out
}

export function renderCustomFieldValue(
  field: CustomFieldConfig,
  notesJson: Record<string, string | null>,
  optionLabels?: Map<string, string>
): string | null {
  const raw = notesJson[field.key]
  if (raw == null) return null
  if (field.type === 'single_select') {
    const labels =
      optionLabels ?? new Map(field.options.map((o) => [o.id, o.label]))
    return labels.get(raw) ?? `(unknown ${raw})`
  }
  return raw
}

export function formatCustomAnswers(
  fields: CustomFieldConfig[],
  notesJson: Record<string, string | null>
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const f of fields) {
    const v = renderCustomFieldValue(f, notesJson)
    if (v !== null) out.push({ label: f.label, value: v })
  }
  return out
}
