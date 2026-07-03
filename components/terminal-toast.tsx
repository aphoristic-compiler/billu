'use client'

import { useEffect, useState } from 'react'

type ToastVariant = 'success' | 'warning' | 'info' | 'error' | 'profit' | 'loss'

type Toast = {
  id: number
  message: string
  variant: 'success' | 'warning' | 'info'
}

type Listener = (t: Toast) => void
let listeners: Listener[] = []
let nextId = 1

function normalizeVariant(v: ToastVariant): Toast['variant'] {
  if (v === 'profit' || v === 'success') return 'success'
  if (v === 'loss' || v === 'error' || v === 'warning') return 'warning'
  return 'info'
}

export function toast(message: string, variant: ToastVariant = 'info') {
  const t = { id: nextId++, message, variant: normalizeVariant(variant) }
  listeners.forEach((l) => l(t))
}

export function TerminalToast({ message, variant = 'info' }: { message: string; variant?: 'success' | 'warning' | 'info' }) {
  return (
    <div
      className={`mt-2 border px-2 py-1 font-mono text-xs ${
        variant === 'success'
          ? 'border-success bg-success/5 text-success'
          : variant === 'warning'
            ? 'border-warning bg-warning/5 text-warning'
            : 'border-accent bg-accent/5 text-accent'
      }`}
    >
      {message}
    </div>
  )
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const listener: Listener = (t) => {
      setToasts((prev) => [...prev, t])
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
      }, 3500)
    }
    listeners.push(listener)
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 left-1/2 z-[100001] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-in-top w-full border font-mono text-xs px-3 py-2 ${
            t.variant === 'success'
              ? 'border-success bg-success/5 text-success'
              : t.variant === 'warning'
                ? 'border-warning bg-warning/5 text-warning'
                : 'border-accent bg-accent/5 text-accent'
          }`}
        >
          <span className="mr-2">
            {t.variant === 'success' ? '✓' : t.variant === 'warning' ? '⚠' : '◆'}
          </span>
          {t.message}
        </div>
      ))}
    </div>
  )
}
