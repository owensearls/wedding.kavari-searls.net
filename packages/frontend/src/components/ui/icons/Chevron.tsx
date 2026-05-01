interface ChevronProps {
  direction: 'up' | 'down'
  className?: string
}

export function Chevron({ direction, className }: ChevronProps) {
  return (
    <svg
      viewBox="0 0 384 512"
      width="0.75em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{
        verticalAlign: 'middle',
        transform: direction === 'down' ? 'rotate(180deg)' : undefined,
        fill: 'currentColor',
      }}
    >
      <path d="M169.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L192 205.3 54.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z" />
    </svg>
  )
}
