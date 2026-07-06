'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logMatch, completeOngoingMatch, logCricketOver, logCricketBatter, logBadmintonSet, logCardsRound, logPokerLedger, deleteMatch } from '@/lib/actions/matches'
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
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [manualWinnerId, setManualWinnerId] = useState<string>('')
  
  const completeMatch = () => {
    startTransition(async () => {
      await completeOngoingMatch(match.id, manualWinnerId ? [manualWinnerId] : undefined)
      toast('Match completed.', 'success')
      router.refresh()
    })
  }

  const liquidateMatch = () => {
    startTransition(async () => {
      await deleteMatch(match.id)
      toast('Match liquidated.', 'success')
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
          <button onClick={() => setShowEndDialog(!showEndDialog)} className="text-muted-foreground hover:text-profit border border-border px-2 rounded bg-background">
            END_MATCH
          </button>
        </div>
      </div>
      
      {match.game.name === 'Cricket' && <CricketScorecard match={match} />}

      {showEndDialog && (
        <div className="mt-4 p-3 border border-secondary/50 rounded bg-background/50">
          <p className="mb-2 text-muted-foreground">Are you sure you want to end this match?</p>
          <div className="mb-3">
            <label className="block text-accent mb-1">Force Winner (Optional):</label>
            <select value={manualWinnerId} onChange={e => setManualWinnerId(e.target.value)} className="w-full bg-background border px-2 py-1">
              <option value="">-- Auto Calculate --</option>
              {match.participants?.map((p: any) => (
                <option key={p.id} value={p.id}>@{p.user?.username}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t border-border">
            <button onClick={liquidateMatch} disabled={pending} className="text-secondary hover:text-background hover:bg-secondary px-2 py-1 border border-secondary rounded">LIQUIDATE (DELETE)</button>
            <button onClick={completeMatch} disabled={pending} className="text-profit hover:text-background hover:bg-profit px-2 py-1 border border-profit rounded">CONFIRM END</button>
          </div>
        </div>
      )}

      {showLogRound && !showEndDialog && (
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

  // Badminton
  const [badmintonSet, setBadmintonSet] = useState(1)
  const [bTeam1, setBTeam1] = useState<string[]>([''])
  const [bTeam2, setBTeam2] = useState<string[]>([''])
  const [bScore1, setBScore1] = useState('')
  const [bScore2, setBScore2] = useState('')

  // Cards
  const [cardsRound, setCardsRound] = useState(1)
  const [cardPlayers, setCardPlayers] = useState<{userId: string, handsMade: string}[]>([{userId: '', handsMade: ''}])

  // Poker
  const [pokerPlayer, setPokerPlayer] = useState({ userId: '', chipsIn: '', chipsOut: '' })

  const cm = match.cricketMatches?.[0]
  const battingFirstTeam = cm?.battingFirst
  const team1Name = cm?.team1Name
  const team2Name = cm?.team2Name

  const currentBattingTeam = inningNumber === 1 ? battingFirstTeam : (battingFirstTeam === team1Name ? team2Name : team1Name);
  const currentBowlingTeam = inningNumber === 1 ? (battingFirstTeam === team1Name ? team2Name : team1Name) : battingFirstTeam;

  const battingPlayers = match.participants?.filter((p: any) => p.teamName === currentBattingTeam) || []
  const bowlingPlayers = match.participants?.filter((p: any) => p.teamName === currentBowlingTeam) || []

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

  const submitBadminton = () => {
    startTransition(async () => {
      const t1 = bTeam1.filter(Boolean)
      const t2 = bTeam2.filter(Boolean)
      if (t1.length === 0 || t2.length === 0) return toast('Select at least 1 player per team', 'error')
      await logBadmintonSet(match.id, badmintonSet, t1, Number(bScore1), t2, Number(bScore2))
      toast('Set logged', 'success')
      setBadmintonSet(s => s + 1)
      setBScore1('')
      setBScore2('')
      router.refresh()
    })
  }

  const submitCards = () => {
    startTransition(async () => {
      const valid = cardPlayers.filter(p => p.userId && p.handsMade)
      if (valid.length === 0) return toast('Enter at least 1 player hand', 'error')
      await logCardsRound(match.id, cardsRound, valid.map(v => ({ userId: v.userId, handsMade: Number(v.handsMade) })))
      toast('Round logged', 'success')
      setCardsRound(r => r + 1)
      router.refresh()
    })
  }

  const submitPoker = () => {
    startTransition(async () => {
      if (!pokerPlayer.userId) return toast('Select player', 'error')
      await logPokerLedger(match.id, pokerPlayer.userId, Number(pokerPlayer.chipsIn), Number(pokerPlayer.chipsOut))
      toast('Ledger updated', 'success')
      setPokerPlayer({ userId: '', chipsIn: '', chipsOut: '' })
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
                {bowlingPlayers.length > 0 ? (
                  bowlingPlayers.map((p: any) => (
                    <option key={p.userId} value={p.userId}>@{p.user?.username}</option>
                  ))
                ) : (
                  members.map((m: any) => (
                    <option key={m.id} value={m.id}>@{m.username}</option>
                  ))
                )}
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
                {battingPlayers.length > 0 ? (
                  battingPlayers.map((p: any) => (
                    <option key={p.userId} value={p.userId}>@{p.user?.username}</option>
                  ))
                ) : (
                  members.map((m: any) => (
                    <option key={m.id} value={m.id}>@{m.username}</option>
                  ))
                )}
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

      {match.game.name === 'Badminton' && (
        <>
          <label className="flex gap-2 items-center text-accent font-bold">
            <span>Set Number:</span>
            <input type="number" value={badmintonSet} onChange={e => setBadmintonSet(Number(e.target.value))} className="w-16 bg-background border px-1" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border p-2 rounded flex flex-col gap-2">
              <h4 className="font-bold">Team 1</h4>
              {bTeam1.map((p, i) => (
                <select key={i} value={p} onChange={e => {
                  const newT = [...bTeam1]; newT[i] = e.target.value; setBTeam1(newT);
                }} className="bg-background border px-1 w-full">
                  <option value="">-- Player --</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
                </select>
              ))}
              {bTeam1.length < 2 && <button onClick={() => setBTeam1([...bTeam1, ''])} className="text-muted-foreground">+ Add Player (Doubles)</button>}
              <input type="number" placeholder="Score" value={bScore1} onChange={e => setBScore1(e.target.value)} className="bg-background border px-1 mt-2" />
            </div>
            
            <div className="border border-border p-2 rounded flex flex-col gap-2">
              <h4 className="font-bold">Team 2</h4>
              {bTeam2.map((p, i) => (
                <select key={i} value={p} onChange={e => {
                  const newT = [...bTeam2]; newT[i] = e.target.value; setBTeam2(newT);
                }} className="bg-background border px-1 w-full">
                  <option value="">-- Player --</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
                </select>
              ))}
              {bTeam2.length < 2 && <button onClick={() => setBTeam2([...bTeam2, ''])} className="text-muted-foreground">+ Add Player (Doubles)</button>}
              <input type="number" placeholder="Score" value={bScore2} onChange={e => setBScore2(e.target.value)} className="bg-background border px-1 mt-2" />
            </div>
          </div>
          <button onClick={submitBadminton} disabled={pending} className="mt-2 bg-secondary text-background px-2 rounded w-full">LOG SET</button>
        </>
      )}

      {match.game.name === 'Cards' && (
        <>
          <label className="flex gap-2 items-center text-accent font-bold">
            <span>Round Number:</span>
            <input type="number" value={cardsRound} onChange={e => setCardsRound(Number(e.target.value))} className="w-16 bg-background border px-1" />
          </label>
          <div className="border border-border p-2 rounded">
            <h4 className="font-bold text-foreground mb-2">Player Hands</h4>
            {cardPlayers.map((cp, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={cp.userId} onChange={e => {
                  const newP = [...cardPlayers]; newP[i].userId = e.target.value; setCardPlayers(newP);
                }} className="bg-background border px-1 flex-1">
                  <option value="">-- Player --</option>
                  {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
                </select>
                <input type="number" placeholder="Hands Made" value={cp.handsMade} onChange={e => {
                  const newP = [...cardPlayers]; newP[i].handsMade = e.target.value; setCardPlayers(newP);
                }} className="bg-background border px-1 w-24" />
              </div>
            ))}
            <button onClick={() => setCardPlayers([...cardPlayers, {userId:'', handsMade:''}])} className="text-muted-foreground w-full mb-2">+ Add Player</button>
            <button onClick={submitCards} disabled={pending} className="bg-secondary text-background px-2 rounded w-full">LOG ROUND</button>
          </div>
        </>
      )}

      {match.game.name === 'Poker' && (
        <div className="border border-border p-2 rounded">
          <h4 className="font-bold text-foreground mb-2">Update Ledger</h4>
          <div className="grid grid-cols-3 gap-2">
            <select value={pokerPlayer.userId} onChange={e => setPokerPlayer(p => ({...p, userId: e.target.value}))} className="bg-background border px-1">
              <option value="">-- Player --</option>
              {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
            </select>
            <input type="number" placeholder="Chips IN" value={pokerPlayer.chipsIn} onChange={e => setPokerPlayer(p => ({...p, chipsIn: e.target.value}))} className="bg-background border px-1" />
            <input type="number" placeholder="Chips OUT" value={pokerPlayer.chipsOut} onChange={e => setPokerPlayer(p => ({...p, chipsOut: e.target.value}))} className="bg-background border px-1" />
          </div>
          <button onClick={submitPoker} disabled={pending} className="mt-2 bg-secondary text-background px-2 rounded w-full">UPDATE CHIPS</button>
        </div>
      )}
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
  const [team1Members, setTeam1Members] = useState<string[]>([])
  const [team2Members, setTeam2Members] = useState<string[]>([])
  const [tossWinner, setTossWinner] = useState('')
  const [tossDecision, setTossDecision] = useState('Bat')
  const [battingFirst, setBattingFirst] = useState('')

  const startMatch = () => {
    startTransition(async () => {
      let participants: any[] = [];
      if (game?.name === 'Cricket') {
        participants = [
           ...team1Members.map(userId => ({ userId, teamName: cricketForm.team1 })),
           ...team2Members.map(userId => ({ userId, teamName: cricketForm.team2 }))
        ]
      }
      
      await logMatch({ 
        gameId, 
        participants,
        status: 'ongoing',
        format: cricketForm.format,
        maxOvers: Number(cricketForm.maxOvers),
        team1Name: cricketForm.team1,
        team2Name: cricketForm.team2,
        tossWinner,
        battingFirst
      })
      toast('Match started.', 'success')
      onClose()
      router.refresh()
    })
  }

  const simulateToss = () => {
    const winner = Math.random() < 0.5 ? cricketForm.team1 : cricketForm.team2;
    const decision = Math.random() < 0.5 ? 'Bat' : 'Bowl';
    setTossWinner(winner);
    setTossDecision(decision);
    if (winner === cricketForm.team1) {
      setBattingFirst(decision === 'Bat' ? cricketForm.team1 : cricketForm.team2);
    } else {
      setBattingFirst(decision === 'Bat' ? cricketForm.team2 : cricketForm.team1);
    }
  }

  return (
    <div className="rounded border border-primary/50 bg-card p-4 mb-4">
      <h3 className="font-mono text-sm font-bold text-primary">NEW_SESSION</h3>
      <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="mt-3 w-full rounded border border-input bg-background px-2 py-2 font-mono text-xs">
        {games.map((g: any) => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
      </select>

      {game?.name === 'Cricket' && (
        <div className="mt-4 border border-secondary/50 rounded p-2 text-xs">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <select value={cricketForm.format} onChange={e => setCricketForm(p => ({...p, format: e.target.value}))} className="bg-background border px-1 py-1">
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
            </select>
            <input type="number" placeholder="Max Overs" value={cricketForm.maxOvers} onChange={e => setCricketForm(p => ({...p, maxOvers: e.target.value}))} className="bg-background border px-1 py-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input placeholder="Team 1 Name" value={cricketForm.team1} onChange={e => setCricketForm(p => ({...p, team1: e.target.value}))} className="w-full bg-background border px-1 py-1 mb-2 font-bold text-accent" />
              {team1Members.map((memberId, idx) => (
                <div key={idx} className="flex gap-1 mb-1">
                  <select value={memberId} onChange={(e) => {
                    const newMembers = [...team1Members];
                    newMembers[idx] = e.target.value;
                    setTeam1Members(newMembers);
                  }} className="w-full bg-background border px-1 py-1">
                    {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
                  </select>
                  <button onClick={() => setTeam1Members(team1Members.filter((_, i) => i !== idx))} className="text-secondary px-1">X</button>
                </div>
              ))}
              <button onClick={() => setTeam1Members([...team1Members, members[0]?.id])} className="w-full text-left text-profit mt-1 text-[10px]">+ Add Player</button>
            </div>
            <div>
              <input placeholder="Team 2 Name" value={cricketForm.team2} onChange={e => setCricketForm(p => ({...p, team2: e.target.value}))} className="w-full bg-background border px-1 py-1 mb-2 font-bold text-accent" />
              {team2Members.map((memberId, idx) => (
                <div key={idx} className="flex gap-1 mb-1">
                  <select value={memberId} onChange={(e) => {
                    const newMembers = [...team2Members];
                    newMembers[idx] = e.target.value;
                    setTeam2Members(newMembers);
                  }} className="w-full bg-background border px-1 py-1">
                    {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
                  </select>
                  <button onClick={() => setTeam2Members(team2Members.filter((_, i) => i !== idx))} className="text-secondary px-1">X</button>
                </div>
              ))}
              <button onClick={() => setTeam2Members([...team2Members, members[0]?.id])} className="w-full text-left text-profit mt-1 text-[10px]">+ Add Player</button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-4 border-t border-border/50 pt-2">
            <div>
              <label className="block text-accent mb-1 font-bold">Toss Winner</label>
              <select value={tossWinner} onChange={e => {
                setTossWinner(e.target.value);
                if (e.target.value === cricketForm.team1) {
                  setBattingFirst(tossDecision === 'Bat' ? cricketForm.team1 : cricketForm.team2);
                } else if (e.target.value === cricketForm.team2) {
                  setBattingFirst(tossDecision === 'Bat' ? cricketForm.team2 : cricketForm.team1);
                }
              }} className="w-full bg-background border px-1 py-1">
                <option value="">-- Select --</option>
                <option value={cricketForm.team1}>{cricketForm.team1}</option>
                <option value={cricketForm.team2}>{cricketForm.team2}</option>
              </select>
            </div>
            <div>
              <label className="block text-accent mb-1 font-bold">Toss Decision</label>
              <select value={tossDecision} onChange={e => {
                setTossDecision(e.target.value);
                if (tossWinner === cricketForm.team1) {
                  setBattingFirst(e.target.value === 'Bat' ? cricketForm.team1 : cricketForm.team2);
                } else if (tossWinner === cricketForm.team2) {
                  setBattingFirst(e.target.value === 'Bat' ? cricketForm.team2 : cricketForm.team1);
                }
              }} className="w-full bg-background border px-1 py-1">
                <option value="Bat">Bat</option>
                <option value="Bowl">Bowl</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2 items-center">
            <button type="button" onClick={simulateToss} className="bg-secondary text-background text-[10px] px-2 py-1 rounded">SIMULATE TOSS</button>
            <div className="text-[10px] text-muted-foreground">
              {tossWinner ? `${tossWinner} won the toss & elected to ${tossDecision === 'Bat' ? 'bat' : 'field'}` : 'No toss simulated'}
            </div>
          </div>
          
          <div className="mt-3">
            <label className="block text-accent mb-1 font-bold">Batting First Team</label>
            <select value={battingFirst} onChange={e => setBattingFirst(e.target.value)} className="w-full bg-background border px-1 py-1">
              <option value="">-- Select --</option>
              <option value={cricketForm.team1}>{cricketForm.team1}</option>
              <option value={cricketForm.team2}>{cricketForm.team2}</option>
            </select>
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <button onClick={onClose} className="font-mono text-xs text-muted-foreground">abort</button>
        <CandlestickButton onClick={startMatch} isLoading={pending}>START_ONGOING</CandlestickButton>
      </div>
    </div>
  )
}
