import styles from './FormGrid.module.css'
import type { CSSProperties, ReactNode } from 'react'

interface FormGridProps {
  cols: 2 | 3 | 4
  children: ReactNode
  style?: CSSProperties
}

function FormGrid({ cols, children, style }: FormGridProps) {
  const colClass =
    cols === 4 ? styles.cols4 : cols === 3 ? styles.cols3 : styles.cols2
  return (
    <div className={`${styles.grid} ${colClass}`} style={style}>
      {children}
    </div>
  )
}

export default FormGrid
