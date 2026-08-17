import { Backdrop } from './Backdrop'
import styles from './EdgeToEdgeLayout.module.css'
import type { ReactNode, Ref } from 'react'

interface EdgeToEdgeLayoutProps {
  children?: ReactNode
  /** Layers rendered inside the viewport shell, above the scroller
      (positioned overlays like nav or artwork foregrounds). */
  overlays?: ReactNode
  scrollerRef?: Ref<HTMLDivElement>
  /** Page-specific additions on the shared pieces (e.g. scroll-driven
      animations on the artwork, snap behavior on the scroller). */
  artworkClassName?: string
  containerClassName?: string
  scrollerClassName?: string
}

function join(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/**
 * The edge-to-edge page scaffold shared by every page: one
 * document-spanning Backdrop, transparent runway spacers above and
 * below, and a full-viewport shell holding the page's scroll
 * container.
 *
 * iOS 26 only renders in-flow, document-space paint in the surface it
 * extends behind the notch, the curved screen corners, and the bottom
 * chrome — position: fixed layers are confined to the inner viewport
 * (confirmed on device). The page therefore loads parked scrolled past
 * the top runway (see PageLayout's initial-scroll script), putting
 * real document pixels under the status-bar scroll-edge effect, and
 * the mandatory root snap (see PageLayout.css) makes that parked
 * position the document's only rest position. All actual scrolling
 * happens in the inner scroller, so the artwork stays put behind the
 * chrome no matter how long the content is.
 */
export function EdgeToEdgeLayout({
  children,
  overlays,
  scrollerRef,
  artworkClassName,
  containerClassName,
  scrollerClassName,
}: EdgeToEdgeLayoutProps) {
  return (
    <>
      <Backdrop className={artworkClassName} />
      <div className={styles.edgeRunwayTop} data-edge-runway-top="" />
      <div className={join(styles.container, containerClassName)}>
        <div
          ref={scrollerRef}
          className={join(styles.scroller, scrollerClassName)}
          data-scroll-root=""
          tabIndex={-1}
        >
          <div className={styles.content}>{children}</div>
        </div>
        {overlays}
      </div>
      <div
        className={styles.edgeRunwayBottom}
        data-edge-runway-bottom=""
        aria-hidden="true"
      />
    </>
  )
}
