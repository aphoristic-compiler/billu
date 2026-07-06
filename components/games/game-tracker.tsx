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
  matchParticipantId: string
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

// ─── Format Round Summaries ───
function formatRounds(match: Match, members: Member[], isOngoing: boolean) {
  if (!match.rounds || match.rounds.length === 0) return null

  if (match.game?.name === 'Cricket') {
    let r1 = { runs: 0, wickets: 0, overs: 0, batters: [] as string[], bowlers: [] as string[] }
    let r2 = { runs: 0, wickets: 0, overs: 0, batters: [] as string[], bowlers: [] as string[] }
    
    for (const r of match.rounds) {
      const summary = r.roundNumber === 1 ? r1 : r2
      for (const s of r.stats) {
        const u = members.find(m => m.id === s.participant.userId || m.id === match.participants.find(p => p.id === s.matchParticipantId)?.userId)
        const name = u?.username || '?'
        if (s.role === 'batting') {
          summary.runs += Number(s.stats.runs) || 0
          if (!summary.batters.includes(name)) summary.batters.push(name)
        }
        if (s.role === 'bowling') {
          summary.wickets += Number(s.stats.wickets) || 0
          summary.overs += Number(s.stats.overs) || 0
          if (!summary.bowlers.includes(name)) summary.bowlers.push(name)
        }
      }
    }

    return (
      <div className="flex flex-col gap-1 text-muted-foreground mt-2">
        {r1.batters.length > 0 && (
          <p>
            <span className="text-foreground font-bold">1st Inning:</span> {r1.runs}/{r1.wickets} ({r1.overs} overs) 
            <span className="text-[10px] ml-2">Bat: {r1.batters.join(', ')} | Bowl: {r1.bowlers.join(', ')}</span>
          </p>
        )}
        {r2.batters.length > 0 && (
          <p>
            <span className="text-foreground font-bold">2nd Inning:</span> {r2.runs}/{r2.wickets} ({r2.overs} overs) 
            <span className="text-[10px] ml-2">Bat: {r2.batters.join(', ')} | Bowl: {r2.bowlers.join(', ')}</span>
          </p>
        )}
        {isOngoing && r1.batters.length > 0 && r2.batters.length > 0 && (
          <p className="text-accent font-bold mt-1">Target: {r1.runs + 1} | Need {r1.runs + 1 - r2.runs} runs in {(match.maxOvers || 20) - r2.overs} overs</p>
        )}
      </div>
    )
  }

  if (match.game?.name === 'Badminton') {
    return (
      <div className="flex flex-col gap-1 text-muted-foreground mt-2">
        {match.rounds.map(r => {
          const s1 = r.stats[0]
          const s2 = r.stats[1]
          if (!s1 || !s2) return null
          const u1 = members.find(m => m.id === s1.participant.userId || m.id === match.participants.find(p => p.id === s1.matchParticipantId)?.userId)?.username
          const u2 = members.find(m => m.id === s2.participant.userId || m.id === match.participants.find(p => p.id === s2.matchParticipantId)?.userId)?.username
          return (
            <p key={r.id}>
              <span className="text-foreground font-bold">Set {r.roundNumber}:</span> {u1} {s1.stats.score} - {s2.stats.score} {u2}
            </p>
          )
        })}
      </div>
    )
  }

  if (match.game?.name === 'Cards') {
    return (
      <div className="flex flex-col gap-1 text-muted-foreground mt-2">
        {match.rounds.map(r => (
          <p key={r.id}>
            <span className="text-foreground font-bold">Round {r.roundNumber}:</span>{' '}
            {r.stats.map(s => {
              const u = members.find(m => m.id === s.participant.userId || m.id === match.participants.find(p => p.id === s.matchParticipantId)?.userId)?.username
              return `${u} (${s.stats.hands_made})`
            }).join(', ')}
          </p>
        ))}
      </div>
    )
  }

  return null
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
              <CompletedMatchCard key={m.id} match={m} currentUserId={currentUserId} members={members} />
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
  const [showLogRound, setShowLogRound] = useState(false)
  
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
        <div className="flex gap-2">
          <button onClick={() => setShowLogRound(!showLogRound)} className="text-muted-foreground hover:text-foreground border border-border px-2 rounded">
            {showLogRound ? 'CANCEL' : 'LOG ROUND'}
          </button>
          <button onClick={completeMatch} className="text-muted-foreground hover:text-profit border border-border px-2 rounded bg-background">
            END_MATCH
          </button>
        </div>
      </div>
      
      {formatRounds(match, members, true)}

      {showLogRound && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <LogRoundForm match={match} members={members} onClose={() => setShowLogRound(false)} />
        </div>
      )}
    </div>
  )
}

function LogRoundForm({ match, members, onClose }: { match: Match, members: Member[], onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [roundNumber, setRoundNumber] = useState(1)

  // Cricket
  const [cricketStats, setCricketStats] = useState({ batter: '', bowler: '', runs: '', wickets: '', overs: '' })
  
  // Badminton
  const [badStats, setBadStats] = useState({ p1: '', s1: '', p2: '', s2: '' })

  // Cards
  const [cardStats, setCardStats] = useState<Record<string, string>>({})

  const submit = () => {
    startTransition(async () => {
      let participants: any[] = []
      
      if (match.game.name === 'Cricket') {
        if (!cricketStats.batter || !cricketStats.bowler) return toast('Select batter and bowler', 'error')
        participants = [
          { userId: cricketStats.batter, role: 'batting', stats: { runs: Number(cricketStats.runs) } },
          { userId: cricketStats.bowler, role: 'bowling', stats: { overs: Number(cricketStats.overs), wickets: Number(cricketStats.wickets), runs_given: Number(cricketStats.runs) } }
        ]
      } else if (match.game.name === 'Badminton') {
        if (!badStats.p1 || !badStats.p2) return toast('Select players', 'error')
        participants = [
          { userId: badStats.p1, isWinner: Number(badStats.s1) > Number(badStats.s2), stats: { score: Number(badStats.s1) } },
          { userId: badStats.p2, isWinner: Number(badStats.s2) > Number(badStats.s1), stats: { score: Number(badStats.s2) } }
        ]
      } else if (match.game.name === 'Cards') {
        participants = Object.entries(cardStats).filter(([_, v]) => v !== '').map(([userId, v]) => ({
          userId,
          stats: { hands_made: Number(v) }
        }))
        if (participants.length === 0) return toast('Enter stats', 'error')
      }

      await addMatchRound({
        matchId: match.id,
        roundNumber,
        type: match.game.name === 'Cricket' ? 'inning' : match.game.name === 'Badminton' ? 'set' : 'round',
        participants
      })

      toast('Round logged.', 'success')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-bold text-accent">Log {match.game.name === 'Cricket' ? 'Inning' : match.game.name === 'Badminton' ? 'Set' : 'Round'} Data</h4>
      
      <label className="flex gap-2 items-center">
        <span>Number:</span>
        <input type="number" value={roundNumber} onChange={e => setRoundNumber(Number(e.target.value))} className="w-16 bg-background border px-1" />
      </label>

      {match.game.name === 'Cricket' && (
        <div className="grid grid-cols-2 gap-2">
          <select value={cricketStats.batter} onChange={e => setCricketStats(p => ({...p, batter: e.target.value}))} className="bg-background border px-1">
            <option value="">-- Batter --</option>
            {members.map(m => <option key={m.id} value={m.id}>@{m.username}</option>)}
          </select>
          <select value={cricketStats.bowler} onChange={e => setCricketStats(p => ({...p, bowler: e.target.value}))} className="bg-background border px-1">
            <option value="">-- Bowler --</option>
            {members.map(m => <option key={m.id} value={m.id}>@{m.username}</option>)}
          </select>
          <input type="number" placeholder="Runs" value={cricketStats.runs} onChange={e => setCricketStats(p => ({...p, runs: e.target.value}))} className="bg-background border px-1" />
          <input type="number" placeholder="Wickets" value={cricketStats.wickets} onChange={e => setCricketStats(p => ({...p, wickets: e.target.value}))} className="bg-background border px-1" />
          <input type="number" placeholder="Overs (e.g. 1, 0.5)" value={cricketStats.overs} onChange={e => setCricketStats(p => ({...p, overs: e.target.value}))} className="bg-background border px-1" />
        </div>
      )}

      {match.game.name === 'Badminton' && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <select value={badStats.p1} onChange={e => setBadStats(p => ({...p, p1: e.target.value}))} className="bg-background border px-1">
              <option value="">-- P1/Team 1 --</option>
              {members.map(m => <option key={m.id} value={m.id}>@{m.username}</option>)}
            </select>
            <input type="number" placeholder="Score" value={badStats.s1} onChange={e => setBadStats(p => ({...p, s1: e.target.value}))} className="bg-background border px-1" />
          </div>
          <div className="flex flex-col gap-1">
            <select value={badStats.p2} onChange={e => setBadStats(p => ({...p, p2: e.target.value}))} className="bg-background border px-1">
              <option value="">-- P2/Team 2 --</option>
              {members.map(m => <option key={m.id} value={m.id}>@{m.username}</option>)}
            </select>
            <input type="number" placeholder="Score" value={badStats.s2} onChange={e => setBadStats(p => ({...p, s2: e.target.value}))} className="bg-background border px-1" />
          </div>
        </div>
      )}

      {match.game.name === 'Cards' && (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-2">
          {members.map(m => (
            <div key={m.id} className="flex justify-between items-center">
              <span>@{m.username}</span>
              <input type="number" placeholder="Hands" value={cardStats[m.id] || ''} onChange={e => setCardStats(p => ({...p, [m.id]: e.target.value}))} className="w-16 bg-background border px-1" />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded">CANCEL</button>
        <CandlestickButton onClick={submit} isLoading={pending}>SAVE LOG</CandlestickButton>
      </div>
    </div>
  )
}

function CompletedMatchCard({ match, currentUserId, members }: { match: Match; currentUserId: string; members: Member[] }) {
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
          {formatRounds(match, members, false)}
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
          Start an ongoing {game?.name} match. You can incrementally log rounds via the terminal or UI.
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
