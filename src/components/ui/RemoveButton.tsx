import type { ButtonHTMLAttributes } from 'react'
import styles from './RemoveButton.module.css'

type RemoveButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  label: string
}

function RemoveButton({ label, className, ...rest }: RemoveButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      aria-label={label}
      title={label}
      className={[styles.removeBtn, className].filter(Boolean).join(' ')}
    >
      ×
    </button>
  )
}

export default RemoveButton
