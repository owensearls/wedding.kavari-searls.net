import type { ReactNode } from 'react'
import './admin.css'
import './AdminShell.css'
import styles from './AdminShell.module.css'

type AdminNavSection = 'guests' | 'events' | 'log' | 'settings'

interface AdminShellProps {
  title: string
  current?: AdminNavSection
  children: ReactNode
}

export function AdminShell({ title, current, children }: AdminShellProps) {
  const navLinkClass = (name: AdminNavSection) =>
    `${styles.navLink} ${current === name ? styles.navLinkActive : ''}`

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link
          rel="icon"
          type="image/svg+xml"
          href={`${import.meta.env.BASE_URL}favicon.svg`}
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <title>{title}</title>
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <div className={styles.shell}>
          <header className={styles.header}>
            <div className={styles.brand}>Wedding Admin</div>
            <nav className={styles.nav}>
              <a href="/admin/" className={navLinkClass('guests')}>
                Guests
              </a>
              <a href="/admin/events/" className={navLinkClass('events')}>
                Events
              </a>
              <a href="/admin/log/" className={navLinkClass('log')}>
                Log
              </a>
              <a
                href="/admin/settings/"
                className={`${navLinkClass('settings')} ${styles.navIcon}`}
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </a>
            </nav>
          </header>
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  )
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
