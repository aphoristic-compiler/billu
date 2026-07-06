const fs = require('fs');
const path = require('path');

const file = path.join('E:', 'code', 'billu', 'components', 'games', 'game-tracker.tsx');
let code = fs.readFileSync(file, 'utf8');

// I need to add Badminton and Cards logic to LogRoundForm
const newLogRoundForm = `function LogRoundForm({ match, members, onClose }: any) {
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
`;

code = code.replace(/function LogRoundForm\(\{ match, members, onClose \}: any\) \{[\s\S]*?    <\/div>\n  \)\n\}/, newLogRoundForm);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully updated game-tracker.tsx for LogRoundForm');
