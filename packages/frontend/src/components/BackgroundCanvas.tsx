'use client'

import { useEffect, useRef } from 'react'

// Endpoints of the existing body::before gradient: sky at the top of the page,
// lawn green once the mountains have risen. We only simulate the COLOR here —
// no images — painting a solid fill into the bottom safe-area strip that the
// Liquid Glass bottom bar sits over.
const SKY = [205, 217, 226] // #cdd9e2
const LAWN = [198, 212, 157] // #c6d49d

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0

    // 0 at the top of the document (RSVP — sky), 1 once #home reaches the top
    // (mountains/lawn fully risen — green). This is what the bottom bar should
    // track as the user scrolls.
    function progress() {
      const home = document.getElementById('home')
      const homeTop = home ? home.offsetTop : window.innerHeight
      return clamp(window.scrollY / Math.max(homeTop, 1), 0, 1)
    }

    function draw() {
      rafId = 0
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas!.clientWidth
      const h = canvas!.clientHeight
      if (w === 0 || h === 0) return
      if (canvas!.width !== Math.round(w * dpr))
        canvas!.width = Math.round(w * dpr)
      if (canvas!.height !== Math.round(h * dpr))
        canvas!.height = Math.round(h * dpr)

      const p = progress()
      const r = lerp(SKY[0], LAWN[0], p)
      const g = lerp(SKY[1], LAWN[1], p)
      const b = lerp(SKY[2], LAWN[2], p)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx!.fillRect(0, 0, w, h)
    }

    function schedule() {
      if (!rafId) rafId = requestAnimationFrame(draw)
    }

    draw()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [])

  return <canvas ref={canvasRef} className="chromeCanvas" aria-hidden="true" />
}
