'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

/**
 * Wraps children; after 2s of no interaction the container drifts 3-8px in a
 * random direction and shrinks slightly. Any interaction snaps it back.
 * Disabled on mobile and for prefers-reduced-motion. Purely cosmetic.
 */
export function HostileDrift({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isMobile || reduced) return

    let timer: ReturnType<typeof setTimeout>

    const drift = () => {
      const dx = (3 + Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1)
      const dy = (3 + Math.random() * 5) * (Math.random() > 0.5 ? 1 : -1)
      gsap.to(el, { x: dx, y: dy, scale: 0.97, duration: 0.8, ease: 'power2.out' })
      timer = setTimeout(drift, 2000)
    }

    const snapBack = () => {
      clearTimeout(timer)
      gsap.to(el, { x: 0, y: 0, scale: 1, duration: 0.25, ease: 'power3.out' })
      timer = setTimeout(drift, 2000)
    }

    timer = setTimeout(drift, 2000)

    const eventNames = ['keydown', 'pointerdown', 'focusin'] as const
    eventNames.forEach((e) => el.addEventListener(e, snapBack))

    return () => {
      clearTimeout(timer)
      eventNames.forEach((e) => el.removeEventListener(e, snapBack))
      gsap.killTweensOf(el)
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
