'use client'

import { useEffect, useRef } from 'react'

type Shape = {
  x: number
  y: number
  vx: number
  vy: number
  kind: 'integral' | 'sigma' | 'candle' | 'maggi'
  size: number
  alpha: number
  candleGreen: boolean
}

function gaussian() {
  // Box-Muller
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export function BrownianCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const COUNT = reduced ? 0 : isMobile ? 10 : 24

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const kinds: Shape['kind'][] = ['integral', 'sigma', 'candle', 'maggi']
    const shapes: Shape[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      kind: kinds[Math.floor(Math.random() * kinds.length)],
      size: 14 + Math.random() * 18,
      alpha: 0.08 + Math.random() * 0.12,
      candleGreen: Math.random() > 0.5,
    }))

    function drawShape(s: Shape) {
      ctx!.save()
      ctx!.globalAlpha = s.alpha
      ctx!.translate(s.x, s.y)
      ctx!.strokeStyle = '#6C757D'
      ctx!.fillStyle = '#6C757D'
      ctx!.lineWidth = 1.5

      if (s.kind === 'integral') {
        ctx!.font = `${s.size * 1.6}px serif`
        ctx!.fillText('∫', 0, 0)
      } else if (s.kind === 'sigma') {
        ctx!.font = `${s.size * 1.4}px serif`
        ctx!.fillText('Σ', 0, 0)
      } else if (s.kind === 'candle') {
        const h = s.size
        const w = s.size * 0.4
        ctx!.strokeStyle = s.candleGreen ? '#34C759' : '#FF3B30'
        ctx!.fillStyle = s.candleGreen ? '#34C759' : '#FF3B30'
        // wick
        ctx!.beginPath()
        ctx!.moveTo(0, -h * 0.7)
        ctx!.lineTo(0, h * 0.7)
        ctx!.stroke()
        // body
        ctx!.fillRect(-w / 2, -h * 0.35, w, h * 0.7)
      } else {
        // maggi bowl outline
        const r = s.size * 0.6
        ctx!.beginPath()
        ctx!.arc(0, 0, r, 0.1 * Math.PI, 0.9 * Math.PI)
        ctx!.stroke()
        // noodle squiggles
        ctx!.beginPath()
        for (let i = -2; i <= 2; i++) {
          ctx!.moveTo(i * r * 0.3 - r * 0.1, -r * 0.15)
          ctx!.quadraticCurveTo(i * r * 0.3, -r * 0.55, i * r * 0.3 + r * 0.1, -r * 0.15)
        }
        ctx!.stroke()
        // steam
        ctx!.beginPath()
        ctx!.moveTo(-r * 0.3, -r * 0.7)
        ctx!.quadraticCurveTo(-r * 0.15, -r * 1.0, -r * 0.3, -r * 1.2)
        ctx!.moveTo(r * 0.3, -r * 0.7)
        ctx!.quadraticCurveTo(r * 0.45, -r * 1.0, r * 0.3, -r * 1.2)
        ctx!.stroke()
      }
      ctx!.restore()
    }

    let raf = 0
    let last = 0
    let paused = document.hidden
    const FRAME_MS = 1000 / 20 // ~20fps

    function tick(t: number) {
      raf = requestAnimationFrame(tick)
      if (paused || t - last < FRAME_MS) return
      last = t

      ctx!.clearRect(0, 0, width, height)
      for (const s of shapes) {
        // brownian drift + gentle damping of scatter velocity
        s.x += gaussian() * 0.6 + s.vx
        s.y += gaussian() * 0.6 + s.vy
        s.vx *= 0.94
        s.vy *= 0.94
        // wrap
        if (s.x < -40) s.x = width + 40
        if (s.x > width + 40) s.x = -40
        if (s.y < -40) s.y = height + 40
        if (s.y > height + 40) s.y = -40
        // occasional candle flip
        if (s.kind === 'candle' && Math.random() < 0.005) s.candleGreen = !s.candleGreen
        drawShape(s)
      }
    }

    function onClick(e: MouseEvent) {
      for (const s of shapes) {
        const dx = s.x - e.clientX
        const dy = s.y - e.clientY
        const dist = Math.max(Math.hypot(dx, dy), 1)
        if (dist < 400) {
          const force = (400 - dist) / 400
          s.vx += (dx / dist) * force * 18
          s.vy += (dy / dist) * force * 18
        }
      }
    }

    function onResize() {
      width = canvas!.width = window.innerWidth
      height = canvas!.height = window.innerHeight
    }

    function onVisibility() {
      paused = document.hidden
    }

    if (COUNT > 0) {
      raf = requestAnimationFrame(tick)
      window.addEventListener('click', onClick)
      window.addEventListener('resize', onResize)
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  )
}
