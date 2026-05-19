'use server'

import {
  getDb,
  parseNotesSchema,
  stringifyNotesSchema,
  type NotesJsonSchema,
} from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  adminSettingsInputSchema,
  type AdminFieldDraft,
  type AdminSettingsInput,
  type AdminSettingsView,
} from '../../schema'

const SETTINGS_ID = 'default'

function getDbConn() {
  return getDb(getEnv().DB)
}

function schemaToDrafts(schema: NotesJsonSchema | null): AdminFieldDraft[] {
  if (!schema) return []
  const out: AdminFieldDraft[] = []
  for (const key of schema['x-fieldOrder']) {
    const field = schema.properties[key]
    if (field) out.push({ key, field })
  }
  return out
}

function draftsToSchema(drafts: AdminFieldDraft[]): NotesJsonSchema | null {
  if (drafts.length === 0) return null
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    'x-fieldOrder': drafts.map((d) => d.key),
    properties: Object.fromEntries(drafts.map((d) => [d.key, d.field])),
  }
}

export async function getAdminSettings(): Promise<AdminSettingsView> {
  const db = getDbConn()
  const row = await db
    .selectFrom('admin_settings')
    .select(['default_invitation_notes_schema', 'lookup_by_name_enabled'])
    .where('id', '=', SETTINGS_ID)
    .executeTakeFirst()
  const parsed = parseNotesSchema(row?.default_invitation_notes_schema ?? null)
  return {
    notesSchema: schemaToDrafts(parsed),
    lookupByNameEnabled: row ? row.lookup_by_name_enabled !== 0 : true,
  }
}

export async function saveAdminSettings(
  input: AdminSettingsInput
): Promise<{ updatedInvitations: number }> {
  const parsed = adminSettingsInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new RscFunctionError(
      400,
      `Invalid settings: ${issue.path.join('.') || ''} ${issue.message}`
    )
  }
  const data = parsed.data
  const db = getDbConn()

  const existing = await db
    .selectFrom('admin_settings')
    .select('default_invitation_notes_schema')
    .where('id', '=', SETTINGS_ID)
    .executeTakeFirst()
  const oldDefault = parseNotesSchema(
    existing?.default_invitation_notes_schema ?? null
  )

  const newDefault = draftsToSchema(data.notesSchema)
  const serialized = newDefault ? stringifyNotesSchema(newDefault) : null
  const lookupFlag = data.lookupByNameEnabled ? 1 : 0

  if (existing) {
    await db
      .updateTable('admin_settings')
      .set({
        default_invitation_notes_schema: serialized,
        lookup_by_name_enabled: lookupFlag,
      })
      .where('id', '=', SETTINGS_ID)
      .execute()
  } else {
    await db
      .insertInto('admin_settings')
      .values({
        id: SETTINGS_ID,
        default_invitation_notes_schema: serialized,
        lookup_by_name_enabled: lookupFlag,
      })
      .execute()
  }

  let updatedInvitations = 0
  if (data.applyToExisting) {
    updatedInvitations = await propagateDefaultChange(oldDefault, newDefault)
  }

  return { updatedInvitations }
}

/**
 * For each invitation row, apply the diff between the old and new default:
 *   - keys removed from the default are removed from the invitation
 *   - keys added to the default are appended to the invitation
 *   - keys whose field definition changed in the default have their field
 *     definition replaced on the invitation
 *   - any key not present in either default is left untouched
 *
 * Returns the count of leaders whose invitations were rewritten (each
 * leader's invitations get the same merged schema written across rows).
 */
async function propagateDefaultChange(
  oldDefault: NotesJsonSchema | null,
  newDefault: NotesJsonSchema | null
): Promise<number> {
  const oldKeys = oldDefault ? Object.keys(oldDefault.properties) : []
  const newKeys = newDefault ? Object.keys(newDefault.properties) : []
  const removed = new Set(oldKeys.filter((k) => !newKeys.includes(k)))
  const added = newKeys.filter((k) => !oldKeys.includes(k))
  const changed = newKeys.filter((k) => {
    if (!oldDefault || !newDefault) return false
    if (!oldKeys.includes(k)) return false
    return (
      JSON.stringify(oldDefault.properties[k]) !==
      JSON.stringify(newDefault.properties[k])
    )
  })

  if (removed.size === 0 && added.length === 0 && changed.length === 0) {
    return 0
  }

  const db = getDbConn()
  const rows = await db
    .selectFrom('invitation')
    .select(['id', 'guest_id', 'notes_schema'])
    .execute()

  const byLeader = new Map<string, typeof rows>()
  for (const r of rows) {
    const arr = byLeader.get(r.guest_id) ?? []
    arr.push(r)
    byLeader.set(r.guest_id, arr)
  }

  let touched = 0
  for (const [leaderId, leaderRows] of byLeader) {
    const current = parseNotesSchema(leaderRows[0]?.notes_schema ?? null)
    const merged = mergeSchemaWithDiff(
      current,
      removed,
      added,
      changed,
      newDefault
    )
    const serialized = merged ? stringifyNotesSchema(merged) : null
    const currentRaw = leaderRows[0]?.notes_schema ?? null
    if (currentRaw === serialized) continue
    await db
      .updateTable('invitation')
      .set({ notes_schema: serialized })
      .where('guest_id', '=', leaderId)
      .execute()
    touched++
  }
  return touched
}

function mergeSchemaWithDiff(
  current: NotesJsonSchema | null,
  removedKeys: Set<string>,
  addedKeys: string[],
  changedKeys: string[],
  newDefault: NotesJsonSchema | null
): NotesJsonSchema | null {
  const order: string[] = []
  const properties: NotesJsonSchema['properties'] = {}

  if (current) {
    for (const key of current['x-fieldOrder']) {
      if (removedKeys.has(key)) continue
      const def = current.properties[key]
      if (!def) continue
      if (changedKeys.includes(key) && newDefault?.properties[key]) {
        properties[key] = newDefault.properties[key]
      } else {
        properties[key] = def
      }
      order.push(key)
    }
  }

  if (newDefault) {
    for (const key of addedKeys) {
      const def = newDefault.properties[key]
      if (!def) continue
      if (!order.includes(key)) {
        order.push(key)
        properties[key] = def
      }
    }
  }

  if (order.length === 0) return null
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    'x-fieldOrder': order,
    properties,
  }
}
