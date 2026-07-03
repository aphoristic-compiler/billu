'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateGame, submitScore } from '@/lib/actions/arcade'
import { CandlestickButton } from '@/components/candlestick-button'
import { toast } from '@/components/terminal-toast'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  username: string
  displayName: string
}
interface ArcadeGame {
  id: string
  prompt: string
  generatedCode: string
  createdAt: string
}
interface LeaderboardRow {
  id: string
  userId: string
  score: number
  attempts: number
  user: Member
}

const SUGGESTIONS = [
  'snake but the food runs away from you',
  'flappy bird but you are a falling stock chart',
  'pong against an AI that trash talks',
  'breakout where bricks are red candles',
  'dodge the margin calls falling from the sky',
]

export function ArcadeConsole({
  active,
  leaderboard,
  currentUserId,
}: {
  active: ArcadeGame | null
  leaderboard: LeaderboardRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [liveScore, setLiveScore] = useState(0)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [submitting, startSubmit] = useTransition()
  const startTimeRef = useRef(Date.now())
  const submittedRef = useRef(false)

  // Listen for score messages from the sandboxed game iframe
  useEffect(() => {
    if (!active) return
    startTimeRef.current = Date.now()
    submittedRef.current = false

    const onMessage = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if (data.type === 'arcade_score_live' && typeof data.score === 'number') {
        setLiveScore(data.score)
      }
      if (data.type === 'arcade_score' && typeof data.score === 'number') {
        setFinalScore(data.score)
        setLiveScore(data.score)
        // Auto-submit on game over (once per session)
        if (!submittedRef.current && data.score > 0) {
          submittedRef.current = true
          const timePlayed = (Date.now() - startTimeRef.current) / 1000
          startSubmit(async () => {
            try {
              await submitScore(active.id, data.score, timePlayed)
              toast(`SCORE ${data.score} FILED TO THE LEDGER`, 'profit')
              router.refresh()
              submittedRef.current = false
            } catch {
              toast('SCORE SUBMISSION FAILED', 'error')
              submittedRef.current = false
            }
          })
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active, router])

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast('Describe the game first. The machine cannot read minds. Yet.', 'error')
      return
    }
    setGenerating(true)
    generateGame(prompt)
      .then(() => {
        toast('GAME PROTOCOL COMPILED', 'profit')
        setPrompt('')
        setLiveScore(0)
        setFinalScore(null)
        router.refresh()
      })
      .catch((err) => {
        toast(err?.message ?? 'GENERATION FAILED. GEMINI REFUSED THE TRADE.', 'error')
      })
      .finally(() => setGenerating(false))
  }

  const myBest = leaderboard.find((r) => r.userId === currentUserId)?.score ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Prompt console */}
      <section className="rounded border border-primary/50 bg-card p-4">
        <h2 className="font-mono text-sm font-bold text-primary">COMPILE_NEW_GAME</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                handleGenerate()
              }
            }}
            placeholder="e.g. snake but the food runs away from you"
            disabled={generating}
            className="flex-1 rounded border border-input bg-background px-3 py-2 font-mono text-sm"
            aria-label="Game prompt"
          />
          <CandlestickButton onClick={handleGenerate} isLoading={generating}>
            GENERATE
          </CandlestickButton>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="rounded border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-accent hover:text-accent"
            >
              {s}
            </button>
          ))}
        </div>
        {generating && (
          <p className="mt-3 animate-pulse font-mono text-xs text-accent">
            [CIPHER] gemini is compiling your game protocol... this takes ~15-30s
          </p>
        )}
      </section>

      {/* Active game */}
      {active ? (
        <section className="rounded border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-mono text-sm font-bold text-accent">NOW_TRADING</h2>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                &quot;{active.prompt}&quot;
              </p>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="text-muted-foreground">
                LIVE: <span className="text-accent">{liveScore}</span>
              </span>
              <span className="text-muted-foreground">
                YOUR_ATH: <span className="text-profit">{myBest}</span>
              </span>
            </div>
          </div>

          <div className="mt-3 aspect-video w-full overflow-hidden rounded border border-border bg-background">
            <iframe
              srcDoc={active.generatedCode}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
              title={`Arcade game: ${active.prompt}`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">
              scores auto-file on game over{submitting && ' — filing...'}
              {finalScore !== null && ` · last run: ${finalScore}`}
            </p>
          </div>
        </section>
      ) : (
        <section className="rounded border border-dashed border-border p-8 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            No active game protocol. Compile one above.
          </p>
        </section>
      )}

      {/* Leaderboard */}
      {active && (
        <section className="rounded border border-border bg-card p-4">
          <h2 className="font-mono text-sm font-bold text-accent">HIGH_SCORE.DAT</h2>
          {leaderboard.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Nobody has scored. The leaderboard is a graveyard.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {leaderboard.map((row, i) => (
                <li
                  key={row.id}
                  className={cn(
                    'flex items-center justify-between border-b border-border/50 pb-2 font-mono text-xs last:border-0',
                    row.userId === currentUserId && 'text-accent',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('w-6', i === 0 ? 'text-accent' : 'text-muted-foreground')}>
                      #{i + 1}
                    </span>
                    <span>@{row.user.username}</span>
                    {i === 0 && <span className="text-accent">👑</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">{row.attempts} runs</span>
                    <span className="font-bold text-profit">
                      {row.score.toLocaleString('en-IN')}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
