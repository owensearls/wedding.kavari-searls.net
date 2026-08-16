import styles from './Backdrop.module.css'

interface BackdropProps {
  className?: string
}

/* The site's watercolor background: a single absolutely positioned
   layer spanning the whole document, painted in document space (never
   position: fixed — iOS 26 confines fixed layers to the inner viewport
   and they never reach behind the notch or chrome). Shared by every
   page so the artwork treatment cannot diverge; pages may layer extras
   (like the main page's parallax drift) via className. With the image
   anchored center-bottom under cover sizing, the top of any page is
   always the sky region — long documents grow toward the mountains at
   the bottom. */
export function Backdrop({ className }: BackdropProps) {
  return (
    <div
      className={
        className ? `${styles.backdrop} ${className}` : styles.backdrop
      }
      data-background=""
      aria-hidden="true"
    />
  )
}
