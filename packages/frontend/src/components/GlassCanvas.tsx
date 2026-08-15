'use client'

import { useEffect, useRef } from 'react'
import styles from './GlassCanvas.module.css'
import type { RefObject } from 'react'

interface GlassCanvasProps {
  scrollerRef: RefObject<HTMLDivElement | null>
}

const BACKGROUND = { src: '/background.avif', fallback: '/background.jpg' }
const MOUNTAINS = { src: '/mountains.avif', fallback: '/mountains.png' }
const MOUNTAINS_RATIO = 1931 / 2687
const BASE_COLOR = '#cccec0'

function loadImage(spec: { src: string; fallback: string }) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      const fb = new Image()
      fb.onload = () => resolve(fb)
      fb.onerror = () => resolve(null)
      fb.src = spec.fallback
    }
    img.src = spec.src
  })
}

/* Replicates `background-size: cover; background-position: center bottom`
   for a box in the canvas's own coordinate space. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number }
) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight)
  const sw = box.w / scale
  const sh = box.h / scale
  const sx = (img.naturalWidth - sw) / 2
  const sy = img.naturalHeight - sh
  ctx.drawImage(img, sx, sy, sw, sh, box.x, box.y, box.w, box.h)
}

/* Mirror canvases for iOS 26 Liquid Glass. The frosted bars composite the
   live pixels of a <canvas> (the only mechanism confirmed on device to put
   real pixels behind the glass — CSS background images never show, and the
   sampler tints bars a flat color). Each canvas sits topmost in a bar's
   footprint but paints exactly what lies beneath it — the artwork, plus the
   mountains at their current parallax height for the bottom bar — so on
   screen it is indistinguishable from the layers it covers, while the glass
   gets real artwork pixels to composite. If Safari doesn't composite them,
   nothing changes visually: the tint strips still color the bars. */
export function GlassCanvas({ scrollerRef }: GlassCanvasProps) {
  const topRef = useRef<HTMLCanvasElement | null>(null)
  const bottomRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const topCanvas = topRef.current
    const bottomCanvas = bottomRef.current
    const scroller = scrollerRef.current
    const container = bottomCanvas?.parentElement
    if (!topCanvas || !bottomCanvas || !scroller || !container) return

    let background: HTMLImageElement | null = null
    let mountains: HTMLImageElement | null = null
    let rafId = 0
    let disposed = false

    // The virtual "screen" box the artwork covers: the container extended
    // past the safe-area insets, matching the CSS backdrop layer.
    function screenBox() {
      const c = container!.getBoundingClientRect()
      const top = topCanvas!.getBoundingClientRect()
      const bottom = bottomCanvas!.getBoundingClientRect()
      const envTop = Math.max(0, c.top - top.top)
      const envBottom = Math.max(0, bottom.bottom - c.bottom)
      return {
        x: c.left,
        y: c.top - envTop,
        w: c.width,
        h: c.height + envTop + envBottom,
        viewH: c.height,
      }
    }

    // Progress of the home section through the scroller's viewport,
    // matching the mountainParallax view-timeline (cover 0% → 100%).
    function parallaxProgress() {
      const home = document.getElementById('home')
      if (!home) return 0
      const s = scroller!
      const homeTop =
        home.getBoundingClientRect().top -
        s.getBoundingClientRect().top +
        s.scrollTop
      const start = homeTop - s.clientHeight
      const length = s.clientHeight + home.offsetHeight
      const p = (s.scrollTop - start) / Math.max(length, 1)
      return Math.min(1, Math.max(0, p))
    }

    // max-height from the mountainParallax keyframes: 0dvh → 50dvh → 250dvh.
    function mountainMaxHeight(p: number, viewH: number) {
      const dvh = p <= 0.5 ? (p / 0.5) * 0.5 : 0.5 + ((p - 0.5) / 0.5) * 2.0
      return dvh * viewH
    }

    function paint(canvas: HTMLCanvasElement, withMountains: boolean) {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(w * dpr)
      const ph = Math.round(h * dpr)
      if (canvas.width !== pw) canvas.width = pw
      if (canvas.height !== ph) canvas.height = ph
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const screen = screenBox()
      const rect = canvas.getBoundingClientRect()
      const ox = screen.x - rect.left
      const oy = screen.y - rect.top

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = BASE_COLOR
      ctx.fillRect(0, 0, w, h)

      if (background) {
        drawCover(ctx, background, { x: ox, y: oy, w: screen.w, h: screen.h })
      }

      if (withMountains && mountains) {
        const naturalH = screen.w * MOUNTAINS_RATIO
        const maxH = mountainMaxHeight(parallaxProgress(), screen.viewH)
        const boxH = Math.min(naturalH, maxH)
        if (boxH > 0) {
          // object-fit: cover with object-position: top on a bottom-anchored,
          // max-height-clipped box: full width, cropped from the image's top.
          const scale = screen.w / mountains.naturalWidth
          ctx.drawImage(
            mountains,
            0,
            0,
            mountains.naturalWidth,
            boxH / scale,
            ox,
            oy + screen.h - boxH,
            screen.w,
            boxH
          )
        }
      }
    }

    function draw() {
      rafId = 0
      paint(topCanvas!, false)
      paint(bottomCanvas!, true)
    }

    function schedule() {
      if (!rafId) rafId = requestAnimationFrame(draw)
    }

    draw()
    Promise.all([loadImage(BACKGROUND), loadImage(MOUNTAINS)]).then(
      ([bg, mts]) => {
        if (disposed) return
        background = bg
        mountains = mts
        schedule()
      }
    )

    scroller.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)

    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      scroller.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [scrollerRef])

  return (
    <>
      <canvas
        ref={topRef}
        className={styles.glassTop}
        data-glass-canvas="top"
        aria-hidden="true"
      />
      <canvas
        ref={bottomRef}
        className={styles.glassBottom}
        data-glass-canvas="bottom"
        aria-hidden="true"
      />
    </>
  )
}
