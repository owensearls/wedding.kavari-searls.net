import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import styles from './AdminApp.module.css'
import EventSettings from './routes/EventSettings'
import GuestList from './routes/GuestList'
import Import from './routes/Import'

function AdminApp() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>Wedding Admin</div>
        <nav className={styles.nav}>
          <NavLink
            to="/groups"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Guests
          </NavLink>
          <NavLink
            to="/events"
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
          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="/groups" element={<GuestList />} />
          <Route path="/import" element={<Import />} />
          <Route path="/events" element={<EventSettings />} />
        </Routes>
      </main>
    </div>
  )
}

export default AdminApp
