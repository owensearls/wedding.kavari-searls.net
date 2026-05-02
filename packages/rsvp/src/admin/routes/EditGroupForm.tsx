'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import {
  adminGroupInputSchema,
  type AdminGroupInput,
  type AdminGuestInput,
} from 'schema/admin'
import { Button } from '../../components/ui/Button'
import { EditFormActions } from '../../components/ui/EditFormActions'
import { EditFormSection } from '../../components/ui/EditFormSection'
import { EditFormShell } from '../../components/ui/EditFormShell'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { FieldGroup } from '../../components/ui/FieldGroup'
import { FormGrid } from '../../components/ui/FormGrid'
import { RemoveButton } from '../../components/ui/RemoveButton'
import { SectionLabel } from '../../components/ui/SectionLabel'
import styles from './EditGroupForm.module.css'
import type { AdminEventRecord } from '../../server/admin/events'

const blankGuest = (): AdminGuestInput => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dietaryRestrictions: '',
  notes: '',
})

interface EditGroupFormProps {
  group: AdminGroupInput
  events: AdminEventRecord[]
  saving: boolean
  serverError: string | null
  onSubmit: (data: AdminGroupInput) => void
  onDelete?: () => void
  onCancel: () => void
}

export function EditGroupForm({
  group,
  events,
  saving,
  serverError,
  onSubmit,
  onDelete,
  onCancel,
}: EditGroupFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<AdminGroupInput>({
    resolver: zodResolver(adminGroupInputSchema),
    defaultValues: group,
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'guests',
  })

  const invitedEventIds = useWatch({ control, name: 'invitedEventIds' }) ?? []

  function fieldError(path: string): string | undefined {
    const parts = path.split('.')
    let obj: unknown = errors
    for (const p of parts) {
      if (obj == null || typeof obj !== 'object') return undefined
      obj = (obj as Record<string, unknown>)[p]
    }
    return (obj as { message?: string } | undefined)?.message
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <EditFormShell
        title={group.id ? 'Edit invite' : 'New invite'}
        onBack={onCancel}
      >
        <ErrorMessage>{serverError}</ErrorMessage>

        <EditFormSection>
          <SectionLabel>Guest</SectionLabel>
          <FormGrid cols={4}>
            <FieldGroup
              label="First name"
              error={fieldError('guests.0.firstName')}
            >
              <input
                className={`admin-input ${fieldError('guests.0.firstName') ? styles.inputError : ''}`}
                {...register('guests.0.firstName')}
              />
            </FieldGroup>
            <FieldGroup label="Last name">
              <input
                className="admin-input"
                {...register('guests.0.lastName')}
              />
            </FieldGroup>
            <FieldGroup label="Email" error={fieldError('guests.0.email')}>
              <input
                className={`admin-input ${fieldError('guests.0.email') ? styles.inputError : ''}`}
                {...register('guests.0.email')}
              />
            </FieldGroup>
            <FieldGroup label="Phone">
              <input className="admin-input" {...register('guests.0.phone')} />
            </FieldGroup>
          </FormGrid>
        </EditFormSection>

        <EditFormSection>
          <SectionLabel
            action={
              <Button variant="ghost" onClick={() => append(blankGuest())}>
                + Add
              </Button>
            }
          >
            Additional guests
          </SectionLabel>

          {fields.length <= 1 ? (
            <p className={styles.muted}>
              No additional guests on this invite yet.
            </p>
          ) : (
            <>
              <FieldGroup
                label="Invite label"
                error={fieldError('label')}
                style={{ maxWidth: 360, marginBottom: 16 }}
              >
                <input
                  className={`admin-input ${fieldError('label') ? styles.inputError : ''}`}
                  placeholder="e.g. The Smith family"
                  {...register('label')}
                />
              </FieldGroup>
              <div className={`${styles.guestRow} ${styles.guestRowHeader}`}>
                <span>First</span>
                <span>Last</span>
                <span>Email</span>
                <span>Phone</span>
                <span />
              </div>
              {fields.slice(1).map((field, i) => {
                const idx = i + 1
                return (
                  <div key={field.id}>
                    <div className={styles.guestRow}>
                      <input
                        className={`admin-input ${fieldError(`guests.${idx}.firstName`) ? styles.inputError : ''}`}
                        {...register(`guests.${idx}.firstName`)}
                      />
                      <input
                        className="admin-input"
                        {...register(`guests.${idx}.lastName`)}
                      />
                      <input
                        className={`admin-input ${fieldError(`guests.${idx}.email`) ? styles.inputError : ''}`}
                        {...register(`guests.${idx}.email`)}
                      />
                      <input
                        className="admin-input"
                        {...register(`guests.${idx}.phone`)}
                      />
                      <RemoveButton
                        label="Remove guest"
                        onClick={() => remove(idx)}
                      />
                    </div>
                    {(fieldError(`guests.${idx}.firstName`) ||
                      fieldError(`guests.${idx}.email`)) && (
                      <div className={styles.guestRowErrors}>
                        {fieldError(`guests.${idx}.firstName`) && (
                          <span className={styles.fieldError}>
                            First name: {fieldError(`guests.${idx}.firstName`)}
                          </span>
                        )}
                        {fieldError(`guests.${idx}.email`) && (
                          <span className={styles.fieldError}>
                            Email: {fieldError(`guests.${idx}.email`)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </EditFormSection>

        <EditFormSection>
          <SectionLabel>Invited to</SectionLabel>
          {events.length === 0 ? (
            <p className={styles.muted}>
              Create some events on the Events tab first.
            </p>
          ) : (
            <div className={styles.eventCheckboxes}>
              {events.map((ev) => (
                <label key={ev.id} className={styles.eventCheckbox}>
                  <input
                    type="checkbox"
                    checked={invitedEventIds.includes(ev.id!)}
                    {...register('invitedEventIds')}
                    value={ev.id!}
                  />
                  <span>{ev.name}</span>
                </label>
              ))}
            </div>
          )}
        </EditFormSection>

        <EditFormActions>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save invite'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {onDelete && (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={onDelete}
            >
              Delete invite
            </button>
          )}
        </EditFormActions>
      </EditFormShell>
    </form>
  )
}
