import { z } from 'zod'

// ── Types (mirror the JSON Schema document we persist) ────────────────────

export interface ShortTextFieldSchema {
  title: string
  type: 'string'
  maxLength: number
}

export interface SingleSelectOptionSchema {
  const: string
  title: string
  description: string | null
}

export interface SingleSelectFieldSchema {
  title: string
  oneOf: SingleSelectOptionSchema[]
}

export type NotesFieldSchema = ShortTextFieldSchema | SingleSelectFieldSchema

export interface NotesJsonSchema {
  $schema?: string
  type: 'object'
  additionalProperties: false
  'x-fieldOrder': string[]
  properties: Record<string, NotesFieldSchema>
}

export type NotesJsonValue = string | null
export type NotesJson = Record<string, NotesJsonValue>

// ── Pure functions over the schema ────────────────────────────────────────

export function parseNotesSchema(raw: string | null): NotesJsonSchema | null {
  if (raw === null || raw === '') return null
  const parsed = JSON.parse(raw) as NotesJsonSchema
  return parsed
}

export function stringifyNotesSchema(schema: NotesJsonSchema): string {
  return JSON.stringify(schema)
}

export function fieldsInOrder(
  schema: NotesJsonSchema
): Array<{ key: string; field: NotesFieldSchema }> {
  const out: Array<{ key: string; field: NotesFieldSchema }> = []
  for (const key of schema['x-fieldOrder']) {
    const field = schema.properties[key]
    if (field) out.push({ key, field })
  }
  return out
}

export function isShortTextField(
  f: NotesFieldSchema
): f is ShortTextFieldSchema {
  return (f as ShortTextFieldSchema).type === 'string'
}

export function isSingleSelectField(
  f: NotesFieldSchema
): f is SingleSelectFieldSchema {
  return Array.isArray((f as SingleSelectFieldSchema).oneOf)
}

export function findOption(
  field: SingleSelectFieldSchema,
  id: string
): SingleSelectOptionSchema | null {
  return field.oneOf.find((o) => o.const === id) ?? null
}

export function buildNotesValidator(
  schema: NotesJsonSchema
): z.ZodType<NotesJson> {
  const shape: Record<string, z.ZodType> = {}
  for (const key of schema['x-fieldOrder']) {
    const field = schema.properties[key]
    if (!field) continue
    if (isShortTextField(field)) {
      shape[key] = z
        .string()
        .transform((s) => s.trim())
        .pipe(
          z
            .string()
            .max(field.maxLength)
            .transform((s) => (s === '' ? null : s))
        )
        .nullable()
        .optional()
    } else if (isSingleSelectField(field)) {
      const consts = field.oneOf.map((o) => o.const)
      const inner =
        consts.length === 1
          ? z.literal(consts[0])
          : z.union(
              consts.map((c) => z.literal(c)) as unknown as readonly [
                z.ZodType,
                z.ZodType,
                ...z.ZodType[],
              ]
            )
      shape[key] = z
        .preprocess((v) => (v === '' ? null : v), inner.nullable())
        .optional()
    }
  }
  // Each field is `.optional()`, so missing keys parse to `undefined`
  // values on the output object. Strip those so the result is a clean
  // `Record<string, string | null>` matching NotesJson.
  return z.strictObject(shape).transform((obj) => {
    const out: NotesJson = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v as NotesJsonValue
    }
    return out
  }) as unknown as z.ZodType<NotesJson>
}
