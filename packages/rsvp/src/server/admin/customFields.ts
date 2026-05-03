'use server'

import { getDb, loadGuestCustomFields, newId } from 'db'
import { getEnv } from 'db/context'
import { RscFunctionError } from 'rsc-utils/functions/server'
import {
  adminCustomFieldInputSchema,
  type AdminCustomFieldInput,
  type CustomFieldConfig,
} from '../../schema'

function getDbConn() {
  return getDb(getEnv().DB)
}

export async function listGuestCustomFields(): Promise<{
  fields: CustomFieldConfig[]
}> {
  const db = getDbConn()
  return { fields: await loadGuestCustomFields(db) }
}

export async function saveGuestCustomField(
  input: AdminCustomFieldInput
): Promise<{ id: string }> {
  const parsed = adminCustomFieldInputSchema.safeParse(input)
  if (!parsed.success) throw new RscFunctionError(400, 'Invalid field data')
  const data = parsed.data
  const db = getDbConn()
  const fieldId = data.id ?? newId('gcf')

  if (data.id) {
    await db
      .updateTable('guest_custom_field')
      .set({
        key: data.key,
        label: data.label,
        type: data.type,
        sort_order: data.sortOrder,
      })
      .where('id', '=', data.id)
      .execute()
  } else {
    const conflict = await db
      .selectFrom('guest_custom_field')
      .select(['id'])
      .where('key', '=', data.key)
      .executeTakeFirst()
    if (conflict) throw new RscFunctionError(409, 'Key already in use')
    await db
      .insertInto('guest_custom_field')
      .values({
        id: fieldId,
        key: data.key,
        label: data.label,
        type: data.type,
        sort_order: data.sortOrder,
      })
      .execute()
  }

  // Diff options.
  const submittedOptionIds = new Set(
    data.options.map((o) => o.id).filter((x): x is string => !!x)
  )
  const existing = await db
    .selectFrom('guest_custom_field_option')
    .select(['id'])
    .where('field_id', '=', fieldId)
    .execute()
  for (const eo of existing) {
    if (!submittedOptionIds.has(eo.id)) {
      await db
        .deleteFrom('guest_custom_field_option')
        .where('id', '=', eo.id)
        .execute()
    }
  }
  for (const o of data.options) {
    if (o.id) {
      await db
        .updateTable('guest_custom_field_option')
        .set({
          label: o.label,
          description: o.description ?? null,
          sort_order: o.sortOrder,
        })
        .where('id', '=', o.id)
        .execute()
    } else {
      await db
        .insertInto('guest_custom_field_option')
        .values({
          id: newId('gcfo'),
          field_id: fieldId,
          label: o.label,
          description: o.description ?? null,
          sort_order: o.sortOrder,
        })
        .execute()
    }
  }

  return { id: fieldId }
}

export async function deleteGuestCustomField(
  id: string
): Promise<{ ok: true }> {
  if (!id) throw new RscFunctionError(400, 'Missing id')
  const db = getDbConn()
  await db.deleteFrom('guest_custom_field').where('id', '=', id).execute()
  return { ok: true }
}
