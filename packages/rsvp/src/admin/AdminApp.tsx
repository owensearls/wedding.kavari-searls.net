import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './admin.css'
import styles from './AdminApp.module.css'
import { EventSettings } from './routes/EventSettings'
import { GuestList } from './routes/GuestList'
import { Import } from './routes/Import'

export function AdminApp() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>Wedding Admin</div>
        <nav className={styles.nav}>
          <NavLink
            to="/admin/groups"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Guests
          </NavLink>
          <NavLink
            to="/admin/events"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Events
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Routes>
          <Route index element={<Navigate to="/admin/groups" replace />} />
          <Route path="groups" element={<GuestList />} />
          <Route path="import" element={<Import />} />
          <Route path="events" element={<EventSettings />} />
        </Routes>
      </main>
    </div>
  )
}
