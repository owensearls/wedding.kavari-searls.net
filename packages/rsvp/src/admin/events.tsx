import { AdminShell } from './AdminShell'
import { EventSettings } from './routes/EventSettings'

export default function AdminEvents() {
  return (
    <AdminShell title="Events · Wedding Admin" current="events">
      <EventSettings />
    </AdminShell>
  )
}
