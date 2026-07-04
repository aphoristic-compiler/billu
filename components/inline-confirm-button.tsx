'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function InlineConfirmButton({
  onClick,
  disabled,
  idleLabel,
  confirmLabel,
  idleClassName,
  confirmClassName,
}: {
  onClick: () => void
  disabled?: boolean
  idleLabel: string
  confirmLabel: string
  idleClassName?: string
  confirmClassName?: string
}) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            setConfirming(false)
            onClick()
          }}
          className={cn("font-mono text-xs animate-pulse", confirmClassName)}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault()
            setConfirming(false)
          }}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          [cancel]
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        setConfirming(true)
      }}
      className={cn("font-mono text-xs", idleClassName)}
    >
      {idleLabel}
    </button>
  )
}
