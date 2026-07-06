'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logMatch, completeOngoingMatch, logCricketOver, logCricketBatter, logBadmintonSet, logCardsRound, logPokerLedger } from '@/lib/actions/matches'
import { CandlestickButton } from '@/components/candlestick-button'
import { toast } from '@/components/terminal-toast'
import { cn } from '@/lib/utils'

export function GameTracker({ games, matches, members, currentUserId }: any) {
  const [showForm, setShowForm] = useState(false)
  
  const ongoingMatches = matches.filter((m: any) => m.status === 'ongoing')
  const completedMatches = matches.filter((m: any) => m.status !== 'ongoing')

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
          {ongoingMatches.map((m: any) => (
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
            {completedMatches.map((m: any) => (
              <CompletedMatchCard key={m.id} match={m} currentUserId={currentUserId} members={members} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function OngoingMatchCard({ match, members }: any) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showLogRound, setShowLogRound] = useState(false)
  
  const completeMatch = () => {
    startTransition(async () => {
      await completeOngoingMatch(match.id)
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
            {showLogRound ? 'CANCEL' : 'LOG DATA'}
          </button>
          <button onClick={completeMatch} className="text-muted-foreground hover:text-profit border border-border px-2 rounded bg-background">
            END_MATCH
          </button>
        </div>
      </div>
      
      {match.game.name === 'Cricket' && <CricketScorecard match={match} />}

      {showLogRound && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <LogRoundForm match={match} members={members} onClose={() => setShowLogRound(false)} />
        </div>
      )}
    </div>
  )
}

function CricketScorecard({ match }: any) {
  const cm = match.cricketMatches?.[0]
  if (!cm) return null
  return (
    <div className="mt-2 text-muted-foreground">
      <p className="font-bold mb-1">Format: {cm.format} ({cm.maxOvers} Overs)</p>
      {cm.innings?.map((inning: any) => (
        <div key={inning.id} className="mb-2 p-2 bg-background border border-border rounded">
          <p className="text-foreground font-bold">
            Inning {inning.inningNumber} ({inning.battingTeam} vs {inning.bowlingTeam})
          </p>
          <p className="text-accent text-lg">{inning.totalRuns}/{inning.totalWickets} <span className="text-xs text-muted-foreground">({inning.totalOvers.toFixed(1)} Ov)</span></p>
          {inning.isDeclared && <p className="text-[10px] text-profit border border-profit px-1 inline-block mt-1">DECLARED</p>}
        </div>
      ))}
    </div>
  )
}

function LogRoundForm({ match, members, onClose }: any) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  
  const [inningNumber, setInningNumber] = useState(1)
  
  // Cricket Over
  const [cricketOver, setCricketOver] = useState({ bowler: '', runs: '', wickets: '' })
  
  // Cricket Batter
  const [cricketBatter, setCricketBatter] = useState({ batter: '', runs: '', balls: '', isOut: false })

  const submitOver = () => {
    startTransition(async () => {
      if (!cricketOver.bowler) return toast('Select bowler', 'error')
      await logCricketOver(match.id, inningNumber, cricketOver.bowler, Number(cricketOver.runs), Number(cricketOver.wickets))
      toast('Over logged', 'success')
      setCricketOver({ bowler: '', runs: '', wickets: '' })
      router.refresh()
    })
  }

  const submitBatter = () => {
    startTransition(async () => {
      if (!cricketBatter.batter) return toast('Select batter', 'error')
      await logCricketBatter(match.id, inningNumber, cricketBatter.batter, Number(cricketBatter.runs), Number(cricketBatter.balls), cricketBatter.isOut)
      toast('Batter logged', 'success')
      setCricketBatter({ batter: '', runs: '', balls: '', isOut: false })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {match.game.name === 'Cricket' && (
        <>
          <label className="flex gap-2 items-center text-accent font-bold">
            <span>Inning Number:</span>
            <input type="number" value={inningNumber} onChange={e => setInningNumber(Number(e.target.value))} className="w-16 bg-background border px-1" />
          </label>
          
          <div className="border border-border p-2 rounded">
            <h4 className="font-bold text-foreground mb-2">Log Bowler Over</h4>
            <div className="grid grid-cols-2 gap-2">
              <select value={cricketOver.bowler} onChange={e => setCricketOver(p => ({...p, bowler: e.target.value}))} className="bg-background border px-1">
                <option value="">-- Bowler --</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
              </select>
              <input type="number" placeholder="Runs Conceded" value={cricketOver.runs} onChange={e => setCricketOver(p => ({...p, runs: e.target.value}))} className="bg-background border px-1" />
              <input type="number" placeholder="Wickets Taken" value={cricketOver.wickets} onChange={e => setCricketOver(p => ({...p, wickets: e.target.value}))} className="bg-background border px-1" />
            </div>
            <button onClick={submitOver} disabled={pending} className="mt-2 bg-secondary text-background px-2 rounded w-full">LOG OVER</button>
          </div>

          <div className="border border-border p-2 rounded">
            <h4 className="font-bold text-foreground mb-2">Log Batter Stats</h4>
            <div className="grid grid-cols-2 gap-2">
              <select value={cricketBatter.batter} onChange={e => setCricketBatter(p => ({...p, batter: e.target.value}))} className="bg-background border px-1">
                <option value="">-- Batter --</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
              </select>
              <input type="number" placeholder="Runs Scored" value={cricketBatter.runs} onChange={e => setCricketBatter(p => ({...p, runs: e.target.value}))} className="bg-background border px-1" />
              <input type="number" placeholder="Balls Faced" value={cricketBatter.balls} onChange={e => setCricketBatter(p => ({...p, balls: e.target.value}))} className="bg-background border px-1" />
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cricketBatter.isOut} onChange={e => setCricketBatter(p => ({...p, isOut: e.target.checked}))} />
                <span>Is Out?</span>
              </label>
            </div>
            <button onClick={submitBatter} disabled={pending} className="mt-2 bg-secondary text-background px-2 rounded w-full">LOG BATTER</button>
          </div>
        </>
      )}

      {/* Basic Forms for other games... */}
    </div>
  )
}

function CompletedMatchCard({ match, currentUserId, members }: any) {
  const winners = match.participants?.filter((p: any) => p.isWinner) || []
  const losers = match.participants?.filter((p: any) => !p.isWinner) || []
  
  return (
    <li className="rounded border border-border bg-card p-3 font-mono text-xs">
      <div className="flex justify-between items-center border-b border-border/50 pb-2 mb-2">
        <p className="font-bold text-foreground">
          {match.game?.icon} {match.game?.name?.toUpperCase()}
        </p>
      </div>
      
      {match.game?.name === 'Cricket' && <CricketScorecard match={match} />}

      <p className="mt-2">
        <span className="text-accent">W[{winners.map((p: any) => p.user?.username).join(', ')}]</span>{' '}
        <span className="text-secondary">L[{losers.map((p: any) => p.user?.username).join(', ')}]</span>
      </p>
    </li>
  )
}

function RecordMatchForm({ games, members, onClose }: any) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gameId, setGameId] = useState(games[0]?.id ?? '')
  const game = games.find((g: any) => g.id === gameId)

  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })

  const startMatch = () => {
    startTransition(async () => {
      await logMatch({ 
        gameId, 
        status: 'ongoing',
        format: cricketForm.format,
        maxOvers: Number(cricketForm.maxOvers),
        team1Name: cricketForm.team1,
        team2Name: cricketForm.team2
      })
      toast('Match started.', 'success')
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="rounded border border-primary/50 bg-card p-4 mb-4">
      <h3 className="font-mono text-sm font-bold text-primary">NEW_SESSION</h3>
      <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="mt-3 w-full rounded border border-input bg-background px-2 py-2 font-mono text-xs">
        {games.map((g: any) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
      </select>

      {game?.name === 'Cricket' && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <select value={cricketForm.format} onChange={e => setCricketForm(p => ({...p, format: e.target.value}))} className="bg-background border px-1">
            <option value="T20">T20</option>
            <option value="ODI">ODI</option>
            <option value="Test">Test</option>
          </select>
          <input type="number" placeholder="Max Overs" value={cricketForm.maxOvers} onChange={e => setCricketForm(p => ({...p, maxOvers: e.target.value}))} className="bg-background border px-1" />
          <input placeholder="Team 1 Name" value={cricketForm.team1} onChange={e => setCricketForm(p => ({...p, team1: e.target.value}))} className="bg-background border px-1" />
          <input placeholder="Team 2 Name" value={cricketForm.team2} onChange={e => setCricketForm(p => ({...p, team2: e.target.value}))} className="bg-background border px-1" />
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onClose} className="font-mono text-xs text-muted-foreground">abort</button>
        <CandlestickButton onClick={startMatch} isLoading={pending}>START_ONGOING</CandlestickButton>
      </div>
    </div>
  )
}
