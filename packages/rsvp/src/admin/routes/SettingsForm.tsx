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
  deleteAllInvites,
  getAdminSettings,
  getInviteCounts,
  saveAdminSettings,
  type InviteCounts,
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
  const [counts, setCounts] = useState<InviteCounts | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function refreshCounts() {
    try {
      setCounts(await getInviteCounts())
    } catch {
      setCounts(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([getAdminSettings(), getInviteCounts()])
      .then(([s, c]) => {
        if (cancelled) return
        setView(s)
        setNotesSchema(s.notesSchema)
        setLookupByNameEnabled(s.lookupByNameEnabled)
        setCounts(c)
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

  async function onDeleteAll() {
    if (!counts) return
    const parts = [
      `${counts.guests} guests`,
      `${counts.invitations} invitations`,
    ]
    if (counts.responses > 0) {
      parts.push(`and ${counts.responses} RSVP responses (cascade)`)
    }
    const ok = confirm(`Delete ${parts.join(', ')}? This cannot be undone.`)
    if (!ok) return
    setDeleting(true)
    setError(null)
    setStatus(null)
    try {
      const r = await deleteAllInvites()
      setStatus(
        `Deleted ${r.deletedGuests} guests and ${r.deletedInvitations} invitations.`
      )
      await refreshCounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

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
    <EditFormShell title="Settings">
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

          <EditFormSection className={styles.dangerZone}>
            <SectionLabel className={styles.dangerLabel}>
              Danger zone
            </SectionLabel>
            <p className={styles.helper}>
              Wipe every guest and invitation in the database. RSVP responses
              tied to those guests are also removed (cascade). Event definitions
              and admin settings are kept.
            </p>
            <p className={styles.dangerCounts}>
              {counts
                ? `Currently: ${counts.guests} guests, ${counts.invitations} invitations, ${counts.responses} RSVP responses.`
                : 'Loading counts…'}
            </p>
            <Button
              className={styles.dangerButton}
              onClick={onDeleteAll}
              disabled={
                deleting ||
                !counts ||
                (counts.guests === 0 && counts.invitations === 0)
              }
            >
              {deleting ? 'Deleting…' : 'Delete all guests and invitations'}
            </Button>
          </EditFormSection>
        </>
      )}
    </EditFormShell>
  )
}
