'use client'

import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { EditFormActions } from '../../components/ui/EditFormActions'
import { EditFormSection } from '../../components/ui/EditFormSection'
import { EditFormShell } from '../../components/ui/EditFormShell'
import { ErrorMessage } from '../../components/ui/ErrorMessage'
import { LoadingIndicator } from '../../components/ui/LoadingIndicator'
import { SectionLabel } from '../../components/ui/SectionLabel'
import {
  getAdminSettings,
  saveAdminSettings,
} from '../../server/admin/settings'
import { CustomFieldsEditor } from './CustomFieldsEditor'
import styles from './SettingsForm.module.css'
import type { AdminFieldDraft, AdminSettingsView } from '../../schema'

export function SettingsForm() {
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AdminSettingsView | null>(null)
  const [notesSchema, setNotesSchema] = useState<AdminFieldDraft[]>([])
  const [lookupByNameEnabled, setLookupByNameEnabled] = useState(true)
  const [applyToExisting, setApplyToExisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getAdminSettings()
      .then((s) => {
        if (cancelled) return
        setView(s)
        setNotesSchema(s.notesSchema)
        setLookupByNameEnabled(s.lookupByNameEnabled)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load')
      )
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSave() {
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const result = await saveAdminSettings({
        notesSchema,
        applyToExisting,
        lookupByNameEnabled,
      })
      setView({ notesSchema, lookupByNameEnabled })
      setApplyToExisting(false)
      setStatus(
        applyToExisting
          ? `Saved. Updated ${result.updatedInvitations} invite${result.updatedInvitations === 1 ? '' : 's'} to match.`
          : 'Saved.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <EditFormShell
      title="Settings"
      backLabel="← Back to guests"
      onBack={() => window.location.assign('/admin/')}
    >
      {loading ? (
        <LoadingIndicator />
      ) : (
        <>
          <ErrorMessage>{error}</ErrorMessage>
          {status && <p className={styles.status}>{status}</p>}

          <EditFormSection>
            <SectionLabel>Public lookup</SectionLabel>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={lookupByNameEnabled}
                onChange={(e) => setLookupByNameEnabled(e.target.checked)}
              />
              <span>
                <strong>Allow looking up invites by name or email</strong>
                <span className={styles.toggleHelp}>
                  When off, guests can only access the RSVP form using their
                  exact invite code — fuzzy name search is disabled.
                </span>
              </span>
            </label>
          </EditFormSection>

          <EditFormSection>
            <SectionLabel>Default invite custom fields</SectionLabel>
            <p className={styles.helper}>
              These fields are added to every new invite (manually created or
              CSV-imported). They live on the invitation, not on individual
              events.
            </p>
            <CustomFieldsEditor
              fields={notesSchema}
              onChange={setNotesSchema}
            />

            {view && (
              <label className={styles.applyCheckbox}>
                <input
                  type="checkbox"
                  checked={applyToExisting}
                  onChange={(e) => setApplyToExisting(e.target.checked)}
                />
                <span>
                  <strong>Apply changes to all existing invites</strong>
                  <span className={styles.toggleHelp}>
                    Adds fields that are new in the default, replaces fields
                    whose definition changed, and removes fields you deleted.
                    Any custom fields already on the invite that aren't part of
                    this default stay untouched.
                  </span>
                </span>
              </label>
            )}
          </EditFormSection>

          <EditFormActions>
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </EditFormActions>
        </>
      )}
    </EditFormShell>
  )
}
