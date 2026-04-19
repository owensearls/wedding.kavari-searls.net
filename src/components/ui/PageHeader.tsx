import styles from './PageHeader.module.css'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <h2 className={styles.title}>{title}</h2>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}

export default PageHeader
