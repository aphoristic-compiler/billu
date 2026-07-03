'use client'

import { useState } from 'react'
import { BootSequence } from './boot-sequence'

export function BootGate({
  seen,
  children,
}: {
  seen: boolean | null
  children: React.ReactNode
}) {
  const [bootDone, setBootDone] = useState(!!seen)

  if (!bootDone) {
    return (
      <BootSequence
        firstVisit={!seen}
        onDone={() => setBootDone(true)}
      />
    )
    // seen is null or false → show full boot sequence; true → show short recap
  }

  return <>{children}</>
}
