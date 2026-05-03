'use client'

import { Button } from '../../components/ui/Button'
import { FieldGroup } from '../../components/ui/FieldGroup'
import { FormGrid } from '../../components/ui/FormGrid'
import { RemoveButton } from '../../components/ui/RemoveButton'
import styles from './CustomFieldsEditor.module.css'
import type { AdminCustomFieldInput } from '../../schema'

interface CustomFieldsEditorProps {
  fields: AdminCustomFieldInput[]
  onChange: (next: AdminCustomFieldInput[]) => void
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

export function CustomFieldsEditor({
  fields,
  onChange,
}: CustomFieldsEditorProps) {
  function update(idx: number, patch: Partial<AdminCustomFieldInput>) {
    const next = [...fields]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  function add() {
    onChange([
      ...fields,
      {
        key: '',
        label: '',
        type: 'short_text',
        sortOrder: fields.length,
        options: [],
      },
    ])
  }

  function remove(idx: number) {
    onChange(fields.filter((_, i) => i !== idx))
  }

  function setOptions(
    fieldIdx: number,
    next: AdminCustomFieldInput['options']
  ) {
    update(fieldIdx, { options: next })
  }

  return (
    <div className={styles.editor}>
      {fields.map((f, idx) => (
        <div key={f.id ?? `new-${idx}`} className={styles.fieldBlock}>
          <FormGrid cols={3}>
            <FieldGroup label="Label">
              <input
                className="admin-input"
                value={f.label}
                onChange={(e) => {
                  const label = e.target.value
                  const next: Partial<AdminCustomFieldInput> = { label }
                  // Auto-slug only if user hasn't customised the key.
                  if (!f.id && (f.key === '' || f.key === slugify(f.label))) {
                    next.key = slugify(label)
                  }
                  update(idx, next)
                }}
              />
            </FieldGroup>
            <FieldGroup label="Key" hint="snake_case, used in stored answers">
              <input
                className="admin-input"
                value={f.key}
                onChange={(e) => update(idx, { key: e.target.value })}
              />
            </FieldGroup>
            <FieldGroup label="Type">
              <select
                className="admin-input"
                value={f.type}
                onChange={(e) =>
                  update(idx, {
                    type: e.target.value as AdminCustomFieldInput['type'],
                    options:
                      e.target.value === 'single_select' ? f.options : [],
                  })
                }
              >
                <option value="short_text">Short text</option>
                <option value="single_select">Single select</option>
              </select>
            </FieldGroup>
          </FormGrid>

          {f.type === 'single_select' && (
            <div className={styles.options}>
              {f.options.map((o, oi) => (
                <div key={o.id ?? `new-${oi}`} className={styles.optionRow}>
                  <input
                    className="admin-input"
                    placeholder="Option label"
                    value={o.label}
                    onChange={(e) => {
                      const next = [...f.options]
                      next[oi] = { ...next[oi], label: e.target.value }
                      setOptions(idx, next)
                    }}
                  />
                  <RemoveButton
                    label="Remove option"
                    onClick={() =>
                      setOptions(
                        idx,
                        f.options.filter((_, i) => i !== oi)
                      )
                    }
                  />
                </div>
              ))}
              <Button
                variant="ghost"
                onClick={() =>
                  setOptions(idx, [
                    ...f.options,
                    {
                      label: '',
                      description: null,
                      sortOrder: f.options.length,
                    },
                  ])
                }
              >
                + Add option
              </Button>
            </div>
          )}

          <div className={styles.fieldFooter}>
            <RemoveButton label="Remove field" onClick={() => remove(idx)} />
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={add}>
        + Add custom field
      </Button>
    </div>
  )
}
