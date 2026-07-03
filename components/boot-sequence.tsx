'use client'

import { useEffect, useRef, useState } from 'react'
import { getRandomLeak, markBootSeen } from '@/lib/actions/boot'

type Leak = {
  id: string
  title: string
  body: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
}

const RARITY_COLOR: Record<Leak['rarity'], string> = {
  common: 'text-chalk-dust border-chalk-faded',
  uncommon: 'text-ticker border-ticker/50',
  rare: 'text-nebula border-nebula/50',
  legendary: 'text-supernova border-supernova/60',
}

const FULL_BOOT_LINES = [
  '> monte_carlo_eval --user=$(whoami) --seed=RANDOM',
  'Resolving stochastic dependencies.............. OK',
  'Evaluating applicant balking rates (P = 3/8)... OK',
  "Computing Lebesgue measure of user's worth..... OK",
  'Sampling from posterior distribution............ OK',
  '[######                        ] 31% ... stalled',
  '[##############################] 100%',
  'p-value: 0.0037 | REJECT H₀: "user is unworthy"',
]

const SHORT_BOOT_LINES = [
  '> monte_carlo_eval --cached --user=$(whoami)',
  'Restoring prior posterior....................... OK',
  'p-value: 0.0037 | STILL WORTHY (barely)',
]

const LEAK_LS_KEY = 'wing_hub_seen_leaks'

export function BootSequence({
  firstVisit,
  onDone,
}: {
  firstVisit: boolean
  onDone: () => void
}) {
  const [lines, setLines] = useState<string[]>([])
  const [leak, setLeak] = useState<Leak | null>(null)
  const [showSkip, setShowSkip] = useState(false)
  const [leakVisible, setLeakVisible] = useState(false)
  const doneRef = useRef(false)

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    if (firstVisit) markBootSeen().catch(() => {})
    onDone()
  }

  useEffect(() => {
    let cancelled = false

    // fetch leak, avoiding last 15 seen
    const seen: string[] = JSON.parse(localStorage.getItem(LEAK_LS_KEY) ?? '[]')
    getRandomLeak(seen)
      .then((l) => {
        if (cancelled || !l) return
        setLeak(l as Leak)
        const next = [...seen, l.id].slice(-15)
        localStorage.setItem(LEAK_LS_KEY, JSON.stringify(next))
      })
      .catch(() => {})

    const bootLines = firstVisit ? FULL_BOOT_LINES : SHORT_BOOT_LINES
    const totalMs = firstVisit ? 3200 : 900
    const perLine = totalMs / bootLines.length

    const timers: ReturnType<typeof setTimeout>[] = []
    bootLines.forEach((line, i) => {
      timers.push(setTimeout(() => setLines((prev) => [...prev, line]), perLine * (i + 1)))
    })
    timers.push(setTimeout(() => setLeakVisible(true), totalMs + 100))
    timers.push(setTimeout(finish, totalMs + (firstVisit ? 2600 : 1600)))
    timers.push(setTimeout(() => setShowSkip(true), 800))

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstVisit])

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-xl">
        <p className="font-display text-supernova mb-4 text-lg tracking-widest">
          WORTHINESS SIMULATION v6.0
        </p>
        <div className="min-h-48 border border-chalk-faded bg-card p-4 text-xs leading-relaxed md:text-sm">
          {lines.map((line, i) => (
            <p
              key={i}
              className={
                line.includes('REJECT') || line.includes('WORTHY')
                  ? 'text-profit'
                  : line.includes('stalled')
                    ? 'text-loss'
                    : 'text-chalk-bright'
              }
            >
              {line}
            </p>
          ))}
          {lines.length > 0 && <span className="terminal-caret" />}

          {leakVisible && leak && (
            <div className={`mt-4 border p-3 ${RARITY_COLOR[leak.rarity]}`}>
              <p className="mb-1 text-[10px] uppercase tracking-widest opacity-70">
                {'/// SYSTEM LEAK — '}
                {leak.rarity}
              </p>
              <p className="font-display text-base">{leak.title}</p>
              <pre className="mt-1 font-mono text-xs whitespace-pre-wrap opacity-90">
                {leak.body}
              </pre>
            </div>
          )}
        </div>

        {showSkip && (
          <button
            type="button"
            onClick={finish}
            className="mt-3 border border-chalk-faded px-3 py-1 text-xs text-chalk-dust transition-colors hover:border-chalk-dust hover:text-chalk-bright"
          >
            {'[ESC] SKIP SIMULATION'}
          </button>
        )}
      </div>
    </div>
  )
}
