import type { AdminGroupInput, AdminGuestInput } from '@shared/schemas/admin'
import Button from '../../components/ui/Button'
import EditFormActions from '../../components/ui/EditFormActions'
import EditFormSection from '../../components/ui/EditFormSection'
import EditFormShell from '../../components/ui/EditFormShell'
import ErrorMessage from '../../components/ui/ErrorMessage'
import FieldGroup from '../../components/ui/FieldGroup'
import FormGrid from '../../components/ui/FormGrid'
import RemoveButton from '../../components/ui/RemoveButton'
import SectionLabel from '../../components/ui/SectionLabel'
import type { AdminEventRecord } from '../api'
import styles from './EditGroupForm.module.css'

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
  error: string | null
  onChange: (next: AdminGroupInput) => void
  onSave: () => void
  onCancel: () => void
}

function EditGroupForm({
  group,
  events,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: EditGroupFormProps) {
  const primary = group.guests[0]
  const additional = group.guests.slice(1)

  function updatePrimary<K extends keyof AdminGuestInput>(
    key: K,
    value: AdminGuestInput[K],
  ) {
    const next = [...group.guests]
    next[0] = { ...next[0], [key]: value }
    onChange({ ...group, guests: next })
  }

  function updateAdditional(
    rowIndex: number,
    field: keyof AdminGuestInput,
    value: string,
  ) {
    const next = [...group.guests]
    const idx = rowIndex + 1
    next[idx] = { ...next[idx], [field]: value }
    onChange({ ...group, guests: next })
  }

  function removeAdditional(rowIndex: number) {
    const idx = rowIndex + 1
    const next = group.guests.filter((_, j) => j !== idx)
    onChange({ ...group, guests: next })
  }

  function toggleEvent(eventId: string, checked: boolean) {
    const set = new Set(group.invitedEventIds ?? [])
    if (checked) set.add(eventId)
    else set.delete(eventId)
    onChange({ ...group, invitedEventIds: [...set] })
  }

  return (
    <EditFormShell
      title={group.id ? 'Edit invite' : 'New invite'}
      onBack={onCancel}
    >
      <ErrorMessage>{error}</ErrorMessage>

      <EditFormSection>
        <SectionLabel>Guest</SectionLabel>
        <FormGrid cols={4}>
          <FieldGroup label="First name">
            <input
              className="admin-input"
              value={primary?.firstName ?? ''}
              onChange={(e) => updatePrimary('firstName', e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Last name">
            <input
              className="admin-input"
              value={primary?.lastName ?? ''}
              onChange={(e) => updatePrimary('lastName', e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Email">
            <input
              className="admin-input"
              value={primary?.email ?? ''}
              onChange={(e) => updatePrimary('email', e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Phone">
            <input
              className="admin-input"
              value={primary?.phone ?? ''}
              onChange={(e) => updatePrimary('phone', e.target.value)}
            />
          </FieldGroup>
        </FormGrid>
      </EditFormSection>

      <EditFormSection>
        <SectionLabel
          action={
            <Button
              variant="ghost"
              onClick={() =>
                onChange({ ...group, guests: [...group.guests, blankGuest()] })
              }
            >
              + Add
            </Button>
          }
        >
          Additional guests
        </SectionLabel>

        {additional.length === 0 ? (
          <p className={styles.muted}>
            No additional guests on this invite yet.
          </p>
        ) : (
          <>
            <FieldGroup
              label="Invite label"
              hint="optional"
              style={{ maxWidth: 360, marginBottom: 16 }}
            >
              <input
                className="admin-input"
                placeholder="e.g. The Smith family"
                value={group.label}
                onChange={(e) => onChange({ ...group, label: e.target.value })}
              />
            </FieldGroup>
            <div className={`${styles.guestRow} ${styles.guestRowHeader}`}>
              <span>First</span>
              <span>Last</span>
              <span>Email</span>
              <span>Phone</span>
              <span />
            </div>
            {additional.map((guest, i) => (
              <div className={styles.guestRow} key={guest.id ?? `new-${i}`}>
                <input
                  className="admin-input"
                  value={guest.firstName}
                  onChange={(e) => updateAdditional(i, 'firstName', e.target.value)}
                />
                <input
                  className="admin-input"
                  value={guest.lastName ?? ''}
                  onChange={(e) => updateAdditional(i, 'lastName', e.target.value)}
                />
                <input
                  className="admin-input"
                  value={guest.email ?? ''}
                  onChange={(e) => updateAdditional(i, 'email', e.target.value)}
                />
                <input
                  className="admin-input"
                  value={guest.phone ?? ''}
                  onChange={(e) => updateAdditional(i, 'phone', e.target.value)}
                />
                <RemoveButton
                  label="Remove guest"
                  onClick={() => removeAdditional(i)}
                />
              </div>
            ))}
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
                  checked={(group.invitedEventIds ?? []).includes(ev.id!)}
                  onChange={(e) => toggleEvent(ev.id!, e.target.checked)}
                />
                <span>{ev.name}</span>
              </label>
            ))}
          </div>
        )}
      </EditFormSection>

      <EditFormActions>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save invite'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </EditFormActions>
    </EditFormShell>
  )
}

export default EditGroupForm
