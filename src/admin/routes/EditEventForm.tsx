import Button from '../../components/ui/Button'
import EditFormActions from '../../components/ui/EditFormActions'
import EditFormSection from '../../components/ui/EditFormSection'
import EditFormShell from '../../components/ui/EditFormShell'
import ErrorMessage from '../../components/ui/ErrorMessage'
import FieldGroup from '../../components/ui/FieldGroup'
import FormGrid from '../../components/ui/FormGrid'
import RemoveButton from '../../components/ui/RemoveButton'
import SectionLabel from '../../components/ui/SectionLabel'
import { isoToLocalInput, localInputToIso } from '../lib/dateHelpers'
import styles from './EditEventForm.module.css'
import type { AdminEventInput } from '@shared/schemas/admin'

interface EditEventFormProps {
  event: AdminEventInput
  saving: boolean
  error: string | null
  onChange: (next: AdminEventInput) => void
  onSave: () => void
  onCancel: () => void
}

function EditEventForm({
  event,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: EditEventFormProps) {
  function updateMeal(idx: number, label: string) {
    const next = [...event.mealOptions]
    next[idx] = { ...next[idx], label }
    onChange({ ...event, mealOptions: next })
  }

  function removeMeal(idx: number) {
    const next = event.mealOptions.filter((_, i) => i !== idx)
    onChange({ ...event, mealOptions: next })
  }

  function addMeal() {
    onChange({
      ...event,
      mealOptions: [...event.mealOptions, { label: '', description: '' }],
    })
  }

  return (
    <EditFormShell
      title={event.id ? 'Edit event' : 'New event'}
      onBack={onCancel}
    >
      <ErrorMessage>{error}</ErrorMessage>

      <EditFormSection>
        <SectionLabel>Details</SectionLabel>
        <FormGrid cols={2}>
          <FieldGroup label="Name">
            <input
              className="admin-input"
              value={event.name}
              onChange={(e) => onChange({ ...event, name: e.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="Slug" hint="lowercase, no spaces">
            <input
              className="admin-input"
              value={event.slug}
              onChange={(e) => onChange({ ...event, slug: e.target.value })}
            />
          </FieldGroup>
        </FormGrid>
        <FormGrid cols={2} style={{ marginTop: 12 }}>
          <FieldGroup label="Location name">
            <input
              className="admin-input"
              value={event.locationName ?? ''}
              onChange={(e) =>
                onChange({ ...event, locationName: e.target.value })
              }
            />
          </FieldGroup>
          <FieldGroup label="Address">
            <input
              className="admin-input"
              value={event.address ?? ''}
              onChange={(e) => onChange({ ...event, address: e.target.value })}
            />
          </FieldGroup>
        </FormGrid>
        <FieldGroup label="Sort order" style={{ marginTop: 12, maxWidth: 120 }}>
          <input
            className="admin-input"
            type="number"
            value={event.sortOrder}
            onChange={(e) =>
              onChange({ ...event, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </FieldGroup>
      </EditFormSection>

      <EditFormSection>
        <SectionLabel>Schedule</SectionLabel>
        <FormGrid cols={3}>
          <FieldGroup label="Starts at">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.startsAt)}
              onChange={(e) =>
                onChange({
                  ...event,
                  startsAt: localInputToIso(e.target.value),
                })
              }
            />
          </FieldGroup>
          <FieldGroup label="Ends at">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.endsAt)}
              onChange={(e) =>
                onChange({ ...event, endsAt: localInputToIso(e.target.value) })
              }
            />
          </FieldGroup>
          <FieldGroup label="RSVP deadline">
            <input
              className="admin-input"
              type="datetime-local"
              value={isoToLocalInput(event.rsvpDeadline)}
              onChange={(e) =>
                onChange({
                  ...event,
                  rsvpDeadline: localInputToIso(e.target.value),
                })
              }
            />
          </FieldGroup>
        </FormGrid>
      </EditFormSection>

      <EditFormSection>
        <SectionLabel>Meal options</SectionLabel>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={event.requiresMealChoice}
            onChange={(e) =>
              onChange({ ...event, requiresMealChoice: e.target.checked })
            }
          />
          Requires meal choice
        </label>

        {event.requiresMealChoice && (
          <>
            {event.mealOptions.map((m, idx) => (
              <div className={styles.mealOptionRow} key={m.id ?? `new-${idx}`}>
                <input
                  className="admin-input"
                  placeholder="Meal name"
                  value={m.label}
                  onChange={(e) => updateMeal(idx, e.target.value)}
                />
                <RemoveButton
                  label="Remove meal option"
                  onClick={() => removeMeal(idx)}
                />
              </div>
            ))}
            <Button variant="ghost" onClick={addMeal}>
              + Add meal option
            </Button>
          </>
        )}
      </EditFormSection>

      <EditFormActions>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save event'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </EditFormActions>
    </EditFormShell>
  )
}

export default EditEventForm
