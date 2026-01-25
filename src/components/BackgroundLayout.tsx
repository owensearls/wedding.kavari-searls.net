import type { ReactNode } from 'react'
import styles from './BackgroundLayout.module.css'

interface BackgroundLayoutProps {
  children?: ReactNode
}

function BackgroundLayout({ children }: BackgroundLayoutProps) {
  return (
    <div className={styles.container}>
      {children}
      <img
        src="/mountains.png"
        className={styles.footerImage}
        alt="Mountains"
      />
    </div>
  )
}

export default BackgroundLayout
