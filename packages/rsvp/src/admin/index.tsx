import { AdminShell } from './AdminShell'
import { GuestList } from './routes/GuestList'

export default function AdminHome() {
  return (
    <AdminShell title="Guests · Wedding Admin" current="guests">
      <GuestList />
    </AdminShell>
  )
}
