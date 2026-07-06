'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logMatch, completeOngoingMatch, addMatchRound } from '@/lib/actions/matches'
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
  statSchema: Record<string, any>
}
interface MatchRoundStat {
  id: string
  teamName: string | null
  role: string | null
  stats: any
  isWinner: boolean
  participant: { userId: string }
}
interface MatchRound {
  id: string
  roundNumber: number
  type: string
  status: string
  stats: MatchRoundStat[]
}
interface Participant {
  id: string
  userId: string
  isWinner: boolean
  stats: Record<string, any>
  user: Member
}
interface Match {
  id: string
  gameId: string
  playedAt: string
  notes: string | null
  status: string
  maxOvers: number | null
  game: Game
  participants: Participant[]
  rounds?: MatchRound[]
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
  
  const ongoingMatches = matches.filter(m => m.status === 'ongoing')
  const completedMatches = matches.filter(m => m.status !== 'ongoing')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold text-accent">ONGOING_MATCHES</h2>
        <CandlestickButton onClick={() => setShowForm(!showForm)}>
          {showForm ? 'ABORT_NEW' : '+ START_MATCH'}
        </CandlestickButton>
      </div>

      {showForm && (
        <RecordMatchForm games={games} members={members} onClose={() => setShowForm(false)} />
      )}

      {ongoingMatches.length > 0 && (
        <div className="flex flex-col gap-3">
          {ongoingMatches.map(m => (
            <OngoingMatchCard key={m.id} match={m} members={members} />
          ))}
        </div>
      )}

      <div className="mt-4">
        <h2 className="font-mono text-sm font-bold text-accent">MATCH_HISTORY</h2>
        {completedMatches.length === 0 ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">No matches played yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {completedMatches.map(m => (
              <CompletedMatchCard key={m.id} match={m} currentUserId={currentUserId} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function OngoingMatchCard({ match, members }: { match: Match; members: Member[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  
  const completeMatch = () => {
    startTransition(async () => {
      await completeOngoingMatch(match.id, [])
      toast('Match completed.', 'success')
      router.refresh()
    })
  }
  
  return (
    <div className="rounded border border-primary/40 bg-card p-3 font-mono text-xs shadow-[0_0_10px_rgba(0,255,0,0.1)]">
      <div className="flex items-center justify-between">
        <span className="font-bold text-profit flex items-center gap-2">
          <span className="animate-pulse h-2 w-2 rounded-full bg-profit"></span>
          {match.game.icon} {match.game.name}
        </span>
        <button onClick={completeMatch} className="text-muted-foreground hover:text-profit">
          END_MATCH
        </button>
      </div>
      <p className="mt-1 text-muted-foreground">Log stats incrementally using the AI terminal!</p>
      
      {match.rounds && match.rounds.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {match.rounds.map(r => (
            <div key={r.id} className="border-t border-border/50 pt-2">
              <p className="font-bold">{r.type.toUpperCase()} {r.roundNumber}</p>
              {r.stats.map(s => {
                const user = members.find(m => m.id === s.participant.userId)
                return (
                  <div key={s.id} className="flex justify-between pl-2 mt-1">
                    <span>@{user?.username} {s.role ? `(${s.role})` : ''}</span>
                    <span className="text-muted-foreground">{JSON.stringify(s.stats)}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CompletedMatchCard({ match, currentUserId }: { match: Match; currentUserId: string }) {
  const winners = match.participants.filter((p) => p.isWinner)
  const losers = match.participants.filter((p) => !p.isWinner)
  
  return (
    <li className="rounded border border-border bg-card p-3 font-mono text-xs">
      <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-2">
        <p className="font-bold text-foreground">
          {match.game?.icon} {match.game?.name?.toUpperCase()}
        </p>
        <span className="text-muted-foreground">
          {new Date(match.playedAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      </div>
      
      {match.game?.name === 'Poker' ? (
        <div className="mt-2">
          {match.participants.map(p => (
            <div key={p.id} className="flex justify-between items-center">
              <span className={p.userId === currentUserId ? 'text-accent font-bold' : ''}>@{p.user.username}</span>
              <span className={(Number(p.stats?.chips_out) - Number(p.stats?.chips_in)) >= 0 ? 'text-profit' : 'text-loss'}>
                {Number(p.stats?.chips_out) - Number(p.stats?.chips_in)}
              </span>
            </div>
          ))}
        </div>
      ) : match.rounds && match.rounds.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-bold text-accent">Overall: {winners.length > 0 ? `W[${winners.map(w => w.user.username).join(', ')}]` : 'Draw'}</p>
          {match.rounds.map(r => (
            <div key={r.id} className="bg-background rounded p-2">
              <p className="text-muted-foreground mb-1 text-[10px]">{r.type.toUpperCase()} {r.roundNumber}</p>
              {r.stats.map(s => (
                <div key={s.id} className="flex justify-between">
                  <span>@{match.participants.find(p => p.id === s.participant?.userId || p.userId === s.participant?.userId)?.user?.username || '?'} {s.role ? `(${s.role})` : ''}</span>
                  <span>{JSON.stringify(s.stats)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-0.5">
          <span className="text-accent">
            W[{winners.map((p) => p.user.username).join(', ') || '—'}]
          </span>{' '}
          <span className="text-secondary">
            L[{losers.map((p) => p.user.username).join(', ') || '—'}]
          </span>
        </p>
      )}
      {match.notes && <p className="mt-2 text-muted-foreground italic">{match.notes}</p>}
    </li>
  )
}

function RecordMatchForm({ games, members, onClose }: { games: Game[], members: Member[], onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gameId, setGameId] = useState(games[0]?.id ?? '')
  const game = games.find((g) => g.id === gameId)

  // Poker simplified state
  const [pokerStats, setPokerStats] = useState<Record<string, { in: string, out: string }>>({})

  // Cricket simple state (for starting ongoing)
  const [maxOvers, setMaxOvers] = useState('20')

  const startMatch = () => {
    startTransition(async () => {
      if (game?.name === 'Poker') {
        const participants = Object.entries(pokerStats)
          .filter(([_, s]) => s.in !== '' && s.out !== '')
          .map(([userId, s]) => ({
            userId,
            isWinner: Number(s.out) > Number(s.in),
            stats: { chips_in: Number(s.in), chips_out: Number(s.out) }
          }))
        if (participants.length === 0) return toast('Add some players', 'error')
        await logMatch({ gameId, participants })
      } else {
        // Start ongoing match
        await logMatch({ 
          gameId, 
          status: 'ongoing',
          maxOvers: game?.name === 'Cricket' ? Number(maxOvers) : undefined,
          participants: [] 
        })
      }
      toast('Match started.', 'success')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="rounded border border-primary/50 bg-card p-4 mb-4">
      <h3 className="font-mono text-sm font-bold text-primary">NEW_SESSION</h3>
      <select
        value={gameId}
        onChange={(e) => setGameId(e.target.value)}
        className="mt-3 w-full rounded border border-input bg-background px-2 py-2 font-mono text-xs"
      >
        {games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.icon} {g.name}
          </option>
        ))}
      </select>

      {game?.name === 'Poker' ? (
        <div className="mt-4 flex flex-col gap-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="font-mono text-xs w-24">@{m.username}</span>
              <input 
                placeholder="In" 
                className="w-20 rounded border bg-background px-2 py-1 font-mono text-xs" 
                value={pokerStats[m.id]?.in ?? ''}
                onChange={e => setPokerStats(p => ({ ...p, [m.id]: { ...p[m.id], in: e.target.value } }))}
              />
              <input 
                placeholder="Out" 
                className="w-20 rounded border bg-background px-2 py-1 font-mono text-xs" 
                value={pokerStats[m.id]?.out ?? ''}
                onChange={e => setPokerStats(p => ({ ...p, [m.id]: { ...p[m.id], out: e.target.value } }))}
              />
            </div>
          ))}
        </div>
      ) : game?.name === 'Cricket' ? (
        <div className="mt-4">
          <label className="font-mono text-xs text-muted-foreground flex flex-col gap-1">
            <span>Max Overs</span>
            <input 
              type="number"
              value={maxOvers} 
              onChange={e => setMaxOvers(e.target.value)} 
              className="rounded border bg-background px-2 py-1"
            />
          </label>
        </div>
      ) : (
        <div className="mt-4 font-mono text-xs text-muted-foreground">
          Start an ongoing {game?.name} match. You can incrementally log rounds via the terminal.
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onClose} className="font-mono text-xs text-muted-foreground">abort</button>
        <CandlestickButton onClick={startMatch} isLoading={pending}>
          {game?.name === 'Poker' ? 'LOG_POKER' : 'START_ONGOING'}
        </CandlestickButton>
      </div>
    </div>
  )
}
