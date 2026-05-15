import styles from './Button.module.css'
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant === 'ghost' ? styles.ghost : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button {...rest} type={type} className={classes} />
}
