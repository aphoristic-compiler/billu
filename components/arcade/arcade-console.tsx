'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateGame, submitScore } from '@/lib/actions/arcade'
import { CandlestickButton } from '@/components/candlestick-button'
import { Trophy, Gamepad2 } from 'lucide-react'
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
  globalLeaderboard?: { userId: string; username: string; totalScore: number }[]
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
            [CIPHER] mistral is compiling your game protocol... this takes ~15-30s
          </p>
        )}
      </section>

      {/* Active game */}
      {active ? (
        <section className="rounded-xl border border-accent/30 bg-card p-5 shadow-[0_0_15px_rgba(52,199,89,0.05)] relative overflow-hidden">
          {/* subtle glow effect */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-profit animate-pulse shadow-[0_0_8px_rgba(52,199,89,0.8)]" />
                <h2 className="font-mono text-sm font-bold text-accent tracking-widest uppercase">NOW_PLAYING</h2>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground uppercase opacity-80">
                PROTOCOL: <span className="text-foreground/80 lowercase">"{active.prompt}"</span>
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-background/80 border border-border px-4 py-2 rounded">
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-0.5">Live Score</p>
                <p className="font-mono text-lg font-bold text-accent tabular-nums leading-none shadow-accent/50 drop-shadow-md">
                  {liveScore.toLocaleString()}
                </p>
              </div>
              <div className="bg-background/80 border border-border px-4 py-2 rounded">
                <p className="font-mono text-[10px] text-muted-foreground uppercase mb-0.5">Your ATH</p>
                <p className="font-mono text-lg font-bold text-profit tabular-nums leading-none">
                  {myBest.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 aspect-video w-full overflow-hidden rounded-md border border-accent/20 bg-[#0B0C10] shadow-[0_0_30px_rgba(0,0,0,0.8)_inset] relative z-10">
            <iframe
              srcDoc={active.generatedCode}
              sandbox="allow-scripts"
              className="h-full w-full border-0 mix-blend-screen"
              title={`Arcade game: ${active.prompt}`}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 relative z-10">
            <p className="font-mono text-[10px] text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary/50" />
              Scores sync automatically on GAME OVER
              {submitting && <span className="text-warning animate-pulse ml-2">SYNCING TO CHAIN...</span>}
            </p>
            {finalScore !== null && (
              <p className="font-mono text-[10px] text-muted-foreground bg-accent/10 px-2 py-1 rounded text-accent">
                Last Run: {finalScore.toLocaleString()}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border p-12 text-center bg-card/30 flex flex-col items-center justify-center">
          <Gamepad2 size={32} className="text-muted-foreground mb-3 opacity-50" />
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
            No active game protocol
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">Compile a new prompt to deploy the arcade cabinet.</p>
        </section>
      )}

      {/* Leaderboard Section */}
      {active && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
              <Trophy size={16} className="text-warning" />
              <h2 className="font-mono text-sm font-bold text-foreground tracking-widest">HIGH_SCORE.DAT (CURRENT)</h2>
            </div>
            
            {leaderboard.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-border/50 rounded bg-background/30">
                <p className="font-mono text-xs text-muted-foreground">Nobody has scored yet.</p>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">Be the first to set the bar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {leaderboard.map((row, i) => (
                  <div
                    key={row.id}
                    className={cn(
                      'group flex items-center justify-between rounded px-3 py-2.5 font-mono text-xs transition-colors',
                      row.userId === currentUserId 
                        ? 'bg-accent/10 border-l-2 border-accent text-accent' 
                        : 'bg-background/40 hover:bg-background/80 border-l-2 border-transparent hover:border-border',
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'w-6 text-center font-bold', 
                        i === 0 ? 'text-warning text-lg' : i === 1 ? 'text-[#C0C0C0]' : i === 2 ? 'text-[#CD7F32]' : 'text-muted-foreground'
                      )}>
                        {i === 0 ? '🏆' : `#${i + 1}`}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold tracking-tight">@{row.user.username}</span>
                        {row.userId === currentUserId && <span className="text-[9px] bg-accent/20 px-1.5 py-0.5 rounded text-accent uppercase">You</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6 text-right">
                      <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
                        {row.attempts} {row.attempts === 1 ? 'run' : 'runs'}
                      </span>
                      <span className={cn(
                        "font-bold tabular-nums text-sm",
                        i === 0 ? "text-warning drop-shadow-sm" : row.userId === currentUserId ? "text-profit" : "text-foreground"
                      )}>
                        {row.score.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
              <Trophy size={16} className="text-profit" />
              <h2 className="font-mono text-sm font-bold text-foreground tracking-widest">GLOBAL_RANKING.DAT (ALL-TIME)</h2>
            </div>
            
            {!globalLeaderboard || globalLeaderboard.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-border/50 rounded bg-background/30">
                <p className="font-mono text-xs text-muted-foreground">No data available.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {globalLeaderboard.map((row, i) => (
                  <div
                    key={row.userId}
                    className={cn(
                      'group flex items-center justify-between rounded px-3 py-2.5 font-mono text-xs transition-colors',
                      row.userId === currentUserId 
                        ? 'bg-profit/10 border-l-2 border-profit text-profit' 
                        : 'bg-background/40 hover:bg-background/80 border-l-2 border-transparent hover:border-border',
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'w-6 text-center font-bold', 
                        i === 0 ? 'text-profit text-lg' : 'text-muted-foreground'
                      )}>
                        {i === 0 ? '🏆' : `#${i + 1}`}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold tracking-tight">@{row.username}</span>
                        {row.userId === currentUserId && <span className="text-[9px] bg-profit/20 px-1.5 py-0.5 rounded text-profit uppercase">You</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <span className={cn(
                        "font-bold tabular-nums text-sm",
                        i === 0 ? "text-profit drop-shadow-sm" : row.userId === currentUserId ? "text-profit" : "text-foreground"
                      )}>
                        {row.totalScore.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
