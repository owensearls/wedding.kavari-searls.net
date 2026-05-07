import { AdminShell } from './AdminShell'
import { Import } from './routes/Import'

export default function AdminImport() {
  return (
    <AdminShell title="Import · Wedding Admin" current="guests">
      <Import />
    </AdminShell>
  )
}
