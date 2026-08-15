'use client'

import { useEffect, useRef } from 'react'
import styles from './ChromeCanvas.module.css'

const BACKGROUND = { src: '/background.avif', fallback: '/background.jpg' }
const MOUNTAINS = { src: '/mountains.avif', fallback: '/mountains.png' }

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

/* Live-pixel canvases in the chrome edge bands, replicating the exact
   configuration validated on device in the PR #13 diagnostic — the only
   setup ever observed to put page pixels into the unsafe areas on iOS
   26: <canvas> elements as DIRECT children of <body>, position: fixed,
   anchored at the viewport edges with env()+constant heights, z-index
   10, repainted on every scroll/viewport event. Safari ignores a canvas
   for bar tinting (no background-color) but composites its live pixels
   into the edge region.

   Unlike the diagnostic's vivid colors, these paint an exact mirror of
   the real layers beneath (the backdrop artwork and the mountains at
   their current parallax height, both read from the live DOM rects each
   frame), so on screen they are indistinguishable from the page. */
export function ChromeCanvas() {
  const topRef = useRef<HTMLCanvasElement | null>(null)
  const bottomRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const topCanvas = topRef.current
    const bottomCanvas = bottomRef.current
    if (!topCanvas || !bottomCanvas) return

    let background: HTMLImageElement | null = null
    let mountains: HTMLImageElement | null = null
    let rafId = 0
    let disposed = false

    function paint(canvas: HTMLCanvasElement) {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pw = Math.round(w * dpr)
      const ph = Math.round(h * dpr)
      if (canvas.width !== pw) canvas.width = pw
      if (canvas.height !== ph) canvas.height = ph
      const ctx = canvas.getContext('2d')
      if (!ctx || !background) return

      const canvasRect = canvas.getBoundingClientRect()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.clearRect(0, 0, w, h)

      // Mirror the backdrop: cover / center bottom into its live rect.
      const bd = document.querySelector('[data-background]')
      if (bd) {
        const r = bd.getBoundingClientRect()
        const scale = Math.max(
          r.width / background.naturalWidth,
          r.height / background.naturalHeight
        )
        const sw = r.width / scale
        const sh = r.height / scale
        ctx.drawImage(
          background,
          (background.naturalWidth - sw) / 2,
          background.naturalHeight - sh,
          sw,
          sh,
          r.left - canvasRect.left,
          r.top - canvasRect.top,
          r.width,
          r.height
        )
      }

      // Mirror the mountains: cover / center top into the img's live,
      // max-height-clipped rect (tracks the parallax automatically).
      const img = document.querySelector('[data-mountains]')
      if (mountains && img) {
        const r = img.getBoundingClientRect()
        if (r.height > 0) {
          const scale = Math.max(
            r.width / mountains.naturalWidth,
            r.height / mountains.naturalHeight
          )
          const sw = r.width / scale
          const sh = r.height / scale
          ctx.drawImage(
            mountains,
            (mountains.naturalWidth - sw) / 2,
            0,
            sw,
            sh,
            r.left - canvasRect.left,
            r.top - canvasRect.top,
            r.width,
            r.height
          )
        }
      }
    }

    function draw() {
      rafId = 0
      paint(topCanvas!)
      paint(bottomCanvas!)
    }

    function schedule() {
      if (!rafId) rafId = requestAnimationFrame(draw)
    }

    const scroller = document.querySelector('[data-scroll-root]')

    draw()
    Promise.all([loadImage(BACKGROUND), loadImage(MOUNTAINS)]).then(
      ([bg, mts]) => {
        if (disposed) return
        background = bg
        mountains = mts
        schedule()
      }
    )

    window.addEventListener('scroll', schedule, { passive: true })
    scroller?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', schedule)
      scroller?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [])

  return (
    <>
      <canvas
        ref={topRef}
        className={styles.top}
        data-chrome-canvas="top"
        aria-hidden="true"
      />
      <canvas
        ref={bottomRef}
        className={styles.bottom}
        data-chrome-canvas="bottom"
        aria-hidden="true"
      />
    </>
  )
}
