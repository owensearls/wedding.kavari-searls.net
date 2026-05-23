import { AdminShell } from './AdminShell'
import { SettingsForm } from './routes/SettingsForm'

export default function AdminSettings() {
  return (
    <AdminShell title="Settings · Wedding Admin" current="settings">
      <SettingsForm />
    </AdminShell>
  )
}
