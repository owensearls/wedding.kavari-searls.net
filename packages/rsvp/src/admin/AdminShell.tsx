import type { ReactNode } from 'react'
import './admin.css'
import './AdminShell.css'
import styles from './AdminShell.module.css'

interface AdminShellProps {
  title: string
  current?: 'guests' | 'events'
  children: ReactNode
}

export function AdminShell({ title, current, children }: AdminShellProps) {
  const navLinkClass = (name: 'guests' | 'events') =>
    `${styles.navLink} ${current === name ? styles.navLinkActive : ''}`

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
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
            </nav>
          </header>
          <main className={styles.main}>{children}</main>
        </div>
      </body>
    </html>
  )
}
