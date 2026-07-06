'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logMatch } from '@/lib/actions/matches'
import { CandlestickButton } from '@/components/candlestick-button'
import { toast } from '@/components/terminal-toast'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  username: string
  displayName: string
}
interface Game {
  id: string
  name: string
  icon: string
  statSchema: Record<string, string>
}
interface Participant {
  id: string
  userId: string
  isWinner: boolean
  stats: Record<string, number | string>
  user: Member
}
interface Match {
  id: string
  gameId: string
  playedAt: string
  notes: string | null
  game: Game
  participants: Participant[]
}

export function GameTracker({
  games,
  matches,
  members,
  currentUserId,
}: {
  games: Game[]
  matches: Match[]
  members: Member[]
  currentUserId: string
}) {
  const [showForm, setShowForm] = useState(false)

  // ─── Derived stats ───
  const myWins = matches.filter((m) =>
    m.participants.some((p) => p.userId === currentUserId && p.isWinner),
  ).length
  const myLosses = matches.filter((m) =>
    m.participants.some((p) => p.userId === currentUserId && !p.isWinner),
  ).length

  const myPokerPnl = useMemo(() => {
    let pnl = 0
    for (const m of matches) {
      if (m.game?.name !== 'Poker') continue
      const me = m.participants.find((p) => p.userId === currentUserId)
      if (!me) continue
      pnl += (Number(me.stats?.chips_out) || 0) - (Number(me.stats?.chips_in) || 0)
    }
    return pnl
  }, [matches, currentUserId])

  const leaderboard = useMemo(() => {
    const map: Record<string, { member: Member; wins: number; losses: number; pokerPnl: number }> = {}
    for (const m of matches) {
      for (const p of m.participants) {
        if (!map[p.userId]) {
          map[p.userId] = { member: p.user, wins: 0, losses: 0, pokerPnl: 0 }
        }
        if (p.isWinner) map[p.userId].wins++
        else map[p.userId].losses++
        if (m.game?.name === 'Poker') {
          map[p.userId].pokerPnl +=
            (Number(p.stats?.chips_out) || 0) - (Number(p.stats?.chips_in) || 0)
        }
      }
    }
    return Object.values(map).sort((a, b) => b.wins - a.wins)
  }, [matches])

  return (
    <div className="flex flex-col gap-4">
      {/* Stats strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            total_matches
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{matches.length}</p>
        </div>
        <div className="rounded border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            your_record
          </p>
          <p className="mt-1 font-mono text-2xl font-bold">
            <span className="text-accent">{myWins}W</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-secondary">{myLosses}L</span>
          </p>
        </div>
        <div className="rounded border border-border bg-card p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            poker_pnl
          </p>
          <p
            className={cn(
              'mt-1 font-mono text-2xl font-bold',
              myPokerPnl >= 0 ? 'text-profit' : 'text-loss',
            )}
          >
            {myPokerPnl >= 0 ? '+' : '−'}{Math.abs(myPokerPnl).toLocaleString('en-IN')} chips
          </p>
        </div>
      </div>

      {/* Record match */}
      {showForm ? (
        <RecordMatchForm games={games} members={members} onClose={() => setShowForm(false)} />
      ) : (
        <div>
          <CandlestickButton onClick={() => setShowForm(true)}>+ LOG_MATCH</CandlestickButton>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Leaderboard */}
        <section className="rounded border border-border bg-card p-4">
          <h2 className="font-mono text-sm font-bold text-accent">GLOBAL_RANKINGS</h2>
          {leaderboard.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              No matches logged. Everyone is unranked. Everyone is safe. For now.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2">
              {leaderboard.map((row, i) => (
                <li
                  key={row.member.id}
                  className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 font-mono text-xs last:border-0"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('w-6', i === 0 ? 'text-accent' : 'text-muted-foreground')}>
                      #{i + 1}
                    </span>
                    <span className="text-foreground">@{row.member.username}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span>
                      <span className="text-accent">{row.wins}W</span>{' '}
                      <span className="text-secondary">{row.losses}L</span>
                    </span>
                    {row.pokerPnl !== 0 && (
                      <span className={row.pokerPnl > 0 ? 'text-profit' : 'text-loss'}>
                        {row.pokerPnl > 0 ? '+' : '−'}{Math.abs(row.pokerPnl).toLocaleString('en-IN')} chips
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Recent matches */}
        <section className="rounded border border-border bg-card p-4">
          <h2 className="font-mono text-sm font-bold text-accent">MATCH_HISTORY</h2>
          {matches.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted-foreground">No matches played yet.</p>
          ) : (
            <ul className="mt-3 flex max-h-96 flex-col gap-3 overflow-y-auto">
              {matches.slice(0, 15).map((m) => {
                const winners = m.participants.filter((p) => p.isWinner)
                const losers = m.participants.filter((p) => !p.isWinner)
                return (
                  <li key={m.id} className="border-l-2 border-primary/40 pl-3 font-mono text-xs">
                    <p className="font-bold text-foreground">
                      {m.game?.icon} {m.game?.name?.toUpperCase()}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {new Date(m.playedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      <span className="text-accent">
                        W[{winners.map((p) => p.user.username).join(', ') || '—'}]
                      </span>{' '}
                      <span className="text-secondary">
                        L[{losers.map((p) => p.user.username).join(', ') || '—'}]
                      </span>
                    </p>
                    {m.notes && <p className="mt-0.5 text-muted-foreground italic">{m.notes}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// ─── Record match form ───
function RecordMatchForm({
  games,
  members,
  onClose,
}: {
  games: Game[]
  members: Member[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gameId, setGameId] = useState(games[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  // per-member: 'out' | 'winner' | 'loser'
  const [roles, setRoles] = useState<Record<string, 'winner' | 'loser' | 'out'>>({})
  // per-member stats: { [statKey]: value }
  const [stats, setStats] = useState<Record<string, Record<string, string>>>({})

  const game = games.find((g) => g.id === gameId)
  const statKeys = Object.keys(game?.statSchema ?? {})
  const playing = members.filter((m) => (roles[m.id] ?? 'out') !== 'out')

  const cycleRole = (id: string) => {
    setRoles((prev) => {
      const cur = prev[id] ?? 'out'
      const next = cur === 'out' ? 'winner' : cur === 'winner' ? 'loser' : 'out'
      return { ...prev, [id]: next }
    })
  }

  const submit = () => {
    const winners = members.filter((m) => roles[m.id] === 'winner')
    const losers = members.filter((m) => roles[m.id] === 'loser')
    if (!gameId) {
      toast('Pick a game.', 'error')
      return
    }
    if (winners.length === 0 || losers.length === 0) {
      toast('Need at least 1 winner and 1 loser. Zero-sum only.', 'error')
      return
    }
    startTransition(async () => {
      try {
        await logMatch({
          gameId,
          notes: notes || undefined,
          participants: [...winners, ...losers].map((m) => ({
            userId: m.id,
            isWinner: roles[m.id] === 'winner',
            stats: Object.fromEntries(
              statKeys
                .map((k) => [k, stats[m.id]?.[k] ?? ''])
                .filter(([, v]) => v !== '')
                .map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)]),
            ),
          })),
        })
        toast('Trade executed. History is written.', 'profit')
        onClose()
        router.refresh()
      } catch {
        toast('Trade failed to clear. Try again.', 'error')
      }
    })
  }

  return (
    <div className="rounded border border-primary/50 bg-card p-4">
      <h3 className="font-mono text-sm font-bold text-primary">LOG_MATCH</h3>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">game</span>
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1.5"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon} {g.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="font-mono text-xs text-muted-foreground">
            players — tap to cycle: <span className="text-profit">WINNER</span> →{' '}
            <span className="text-loss">LOSER</span> → out
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const role = roles[m.id] ?? 'out'
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => cycleRole(m.id)}
                  className={cn(
                    'rounded border px-3 py-1 font-mono text-xs transition-colors',
                    role === 'winner' && 'border-profit text-profit bg-profit/10',
                    role === 'loser' && 'border-loss text-loss bg-loss/10',
                    role === 'out' && 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                  aria-pressed={role !== 'out'}
                >
                  @{m.username}
                  {role === 'winner' && ' [W]'}
                  {role === 'loser' && ' [L]'}
                </button>
              )
            })}
          </div>
        </div>

        {statKeys.length > 0 && playing.length > 0 && (
          <div className="border-l-2 border-primary/40 pl-3">
            <p className="font-mono text-xs text-muted-foreground">stats (optional)</p>
            <div className="mt-2 flex flex-col gap-2">
              {playing.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 shrink-0 font-mono text-xs text-foreground/80">
                    @{m.username}
                  </span>
                  {statKeys.map((k) => (
                    <input
                      key={k}
                      value={stats[m.id]?.[k] ?? ''}
                      onChange={(e) =>
                        setStats((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], [k]: e.target.value },
                        }))
                      }
                      placeholder={k}
                      className="w-24 rounded border border-input bg-background px-2 py-1 font-mono text-xs"
                      aria-label={`${m.username} ${k}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="trash talk, controversies, disputed calls..."
            className="rounded border border-input bg-background px-2 py-1.5"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            abort
          </button>
          <CandlestickButton onClick={submit} isLoading={pending}>
            EXECUTE_TRADE
          </CandlestickButton>
        </div>
      </div>
    </div>
  )
}
