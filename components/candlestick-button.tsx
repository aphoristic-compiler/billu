'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { toast } from '@/components/terminal-toast'

export function CandlestickButton({
  label,
  onSuccess,
  className = '',
}: {
  label: string
  onSuccess: () => void
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isGreenRef = useRef(true)
  const [isGreen, setIsGreen] = useState(true)
  const rejectionsRef = useRef(0)
  const [mercy, setMercy] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 120
    const H = 40
    const candles: { open: number; close: number }[] = Array.from(
      { length: 12 },
      () => {
        const open = 10 + Math.random() * 20
        return { open, close: open + (Math.random() - 0.5) * 14 }
      },
    )

    function draw() {
      ctx!.clearRect(0, 0, W, H)
      // midline
      ctx!.strokeStyle = '#3A3F47'
      ctx!.beginPath()
      ctx!.moveTo(0, H / 2)
      ctx!.lineTo(W, H / 2)
      ctx!.stroke()

      candles.forEach((c, i) => {
        const x = 4 + i * 10
        const green = c.close <= c.open
        ctx!.fillStyle = green ? '#34C759' : '#FF3B30'
        ctx!.strokeStyle = ctx!.fillStyle
        const top = Math.min(c.open, c.close)
        const h = Math.max(Math.abs(c.close - c.open), 2)
        ctx!.beginPath()
        ctx!.moveTo(x + 3, Math.max(top - 4, 2))
        ctx!.lineTo(x + 3, Math.min(top + h + 4, H - 2))
        ctx!.stroke()
        ctx!.fillRect(x, top, 6, h)
      })
    }

    draw()

    const interval = setInterval(() => {
      // shift candles, push a new one
      candles.shift()
      const prev = candles[candles.length - 1]
      const open = prev.close
      const close = Math.min(Math.max(open + (Math.random() - 0.5) * 16, 4), H - 4)
      candles.push({ open, close })
      const lastGreen = close <= open
      isGreenRef.current = lastGreen
      setIsGreen(lastGreen)
      draw()
    }, 300)

    return () => clearInterval(interval)
  }, [])

  const handleClick = useCallback(() => {
    if (isGreenRef.current || mercy || rejectionsRef.current >= 3) {
      onSuccess()
      return
    }
    rejectionsRef.current += 1
    gsap.to(document.body, { x: '+=5', yoyo: true, repeat: 5, duration: 0.05, clearProps: 'x' })
    toast('STOP-LOSS HIT. TRY AGAIN.', 'loss')
    if (rejectionsRef.current >= 3) {
      setMercy(true)
      toast('MERCY RULE ACTIVATED. POSITION FORCED GREEN.', 'profit')
    }
  }, [mercy, onSuccess])

  const effectiveGreen = isGreen || mercy

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group flex items-center gap-3 border px-4 py-2 font-mono text-sm transition-colors ${
        effectiveGreen
          ? 'border-profit text-profit hover:bg-profit/10'
          : 'border-loss text-loss hover:bg-loss/10'
      } ${className}`}
    >
      <canvas ref={canvasRef} width={120} height={40} aria-hidden="true" />
      <span className="whitespace-nowrap">
        {label}
        <span className="ml-2 text-xs opacity-70">
          {effectiveGreen ? '[MARKET: GREEN]' : '[MARKET: RED]'}
        </span>
      </span>
    </button>
  )
}
