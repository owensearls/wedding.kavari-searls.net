'use client'

import { newId } from 'db'
import { Button } from '../../components/ui/Button'
import { FieldGroup } from '../../components/ui/FieldGroup'
import { FormGrid } from '../../components/ui/FormGrid'
import { RemoveButton } from '../../components/ui/RemoveButton'
import styles from './CustomFieldsEditor.module.css'
import type {
  AdminFieldDraft,
  NotesFieldInput,
  ShortTextFieldInput,
  SingleSelectFieldInput,
} from '../../schema'

interface CustomFieldsEditorProps {
  fields: AdminFieldDraft[]
  onChange: (next: AdminFieldDraft[]) => void
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function isShortText(f: NotesFieldInput): f is ShortTextFieldInput {
  return (f as ShortTextFieldInput).type === 'string'
}

function isSingleSelect(f: NotesFieldInput): f is SingleSelectFieldInput {
  return Array.isArray((f as SingleSelectFieldInput).oneOf)
}

function fieldType(f: NotesFieldInput): 'short_text' | 'single_select' {
  return isShortText(f) ? 'short_text' : 'single_select'
}

function newOptionId(): string {
  return newId('opt').replace(/^opt_/, 'opt_').slice(0, 24)
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: CustomFieldsEditorProps) {
  function update(idx: number, patch: Partial<AdminFieldDraft>) {
    const next = [...fields]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  function updateField(idx: number, field: NotesFieldInput) {
    update(idx, { field })
  }

  function add() {
    onChange([
      ...fields,
      {
        key: '',
        field: { title: '', type: 'string', maxLength: 500 },
      },
    ])
  }

  function remove(idx: number) {
    onChange(fields.filter((_, i) => i !== idx))
  }

  return (
    <div className={styles.editor}>
      {fields.map((draft, idx) => {
        const type = fieldType(draft.field)
        return (
          <div key={idx} className={styles.fieldBlock}>
            <FormGrid cols={3}>
              <FieldGroup label="Label">
                <input
                  className="admin-input"
                  value={draft.field.title}
                  onChange={(e) => {
                    const title = e.target.value
                    const nextField = { ...draft.field, title }
                    const patch: Partial<AdminFieldDraft> = {
                      field: nextField,
                    }
                    if (
                      draft.key === '' ||
                      draft.key === slugify(draft.field.title)
                    ) {
                      patch.key = slugify(title)
                    }
                    update(idx, patch)
                  }}
                />
              </FieldGroup>
              <FieldGroup label="Key" hint="snake_case, used in stored answers">
                <input
                  className="admin-input"
                  value={draft.key}
                  onChange={(e) => update(idx, { key: e.target.value })}
                />
              </FieldGroup>
              <FieldGroup label="Type">
                <select
                  className="admin-input"
                  value={type}
                  onChange={(e) => {
                    const nextType = e.target.value as
                      | 'short_text'
                      | 'single_select'
                    if (nextType === 'short_text') {
                      updateField(idx, {
                        title: draft.field.title,
                        type: 'string',
                        maxLength: 500,
                      })
                    } else {
                      updateField(idx, {
                        title: draft.field.title,
                        oneOf: [],
                      })
                    }
                  }}
                >
                  <option value="short_text">Short text</option>
                  <option value="single_select">Single select</option>
                </select>
              </FieldGroup>
            </FormGrid>

            {isSingleSelect(draft.field) && (
              <div className={styles.options}>
                {draft.field.oneOf.map((opt, oi) => (
                  <div key={oi} className={styles.optionRow}>
                    <input
                      className="admin-input"
                      placeholder="Option label"
                      value={opt.title}
                      onChange={(e) => {
                        const oneOf = [
                          ...(draft.field as SingleSelectFieldInput).oneOf,
                        ]
                        oneOf[oi] = { ...oneOf[oi], title: e.target.value }
                        updateField(idx, {
                          ...draft.field,
                          oneOf,
                        } as SingleSelectFieldInput)
                      }}
                    />
                    <RemoveButton
                      label="Remove option"
                      onClick={() => {
                        const oneOf = (
                          draft.field as SingleSelectFieldInput
                        ).oneOf.filter((_, i) => i !== oi)
                        updateField(idx, {
                          ...draft.field,
                          oneOf,
                        } as SingleSelectFieldInput)
                      }}
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  onClick={() => {
                    const oneOf = [
                      ...(draft.field as SingleSelectFieldInput).oneOf,
                      {
                        const: newOptionId(),
                        title: '',
                        description: null,
                      },
                    ]
                    updateField(idx, {
                      ...draft.field,
                      oneOf,
                    } as SingleSelectFieldInput)
                  }}
                >
                  + Add option
                </Button>
              </div>
            )}

            <div className={styles.fieldFooter}>
              <RemoveButton label="Remove field" onClick={() => remove(idx)} />
            </div>
          </div>
        )
      })}
      <Button variant="ghost" onClick={add}>
        + Add custom field
      </Button>
    </div>
  )
}
