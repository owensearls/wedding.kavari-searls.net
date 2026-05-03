import { AdminShell } from './AdminShell'
import { Log } from './routes/Log'

export default function AdminLog() {
  return (
    <AdminShell title="Log · Wedding Admin" current="log">
      <Log />
    </AdminShell>
  )
}
