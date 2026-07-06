const fs = require('fs');

const path = 'components/games/game-tracker.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update LogRoundForm to compute battingPlayers and bowlingPlayers, and update the dropdowns
const oldLogRound = `function LogRoundForm({ match, members, onClose }: any) {
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
  const [pokerPlayer, setPokerPlayer] = useState({ userId: '', chipsIn: '', chipsOut: '' })`;

const newLogRound = `function LogRoundForm({ match, members, onClose }: any) {
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
  const bowlingPlayers = match.participants?.filter((p: any) => p.teamName === currentBowlingTeam) || []`;

code = code.replace(oldLogRound, newLogRound);

// Update dropdowns
const oldBowlerDropdown = `<select value={cricketOver.bowler} onChange={e => setCricketOver(p => ({...p, bowler: e.target.value}))} className="bg-background border px-1">
                <option value="">-- Bowler --</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
              </select>`;

const newBowlerDropdown = `<select value={cricketOver.bowler} onChange={e => setCricketOver(p => ({...p, bowler: e.target.value}))} className="bg-background border px-1">
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
              </select>`;

code = code.replace(oldBowlerDropdown, newBowlerDropdown);

const oldBatterDropdown = `<select value={cricketBatter.batter} onChange={e => setCricketBatter(p => ({...p, batter: e.target.value}))} className="bg-background border px-1">
                <option value="">-- Batter --</option>
                {members.map((m: any) => <option key={m.id} value={m.id}>@{m.username}</option>)}
              </select>`;

const newBatterDropdown = `<select value={cricketBatter.batter} onChange={e => setCricketBatter(p => ({...p, batter: e.target.value}))} className="bg-background border px-1">
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
              </select>`;

code = code.replace(oldBatterDropdown, newBatterDropdown);


// 2. Update RecordMatchForm
const oldRecordMatchForm = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })
  const [team1Members, setTeam1Members] = useState<string[]>([])
  const [team2Members, setTeam2Members] = useState<string[]>([])

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
        <div className="mt-4 border border-secondary/50 rounded p-2 text-xs">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <select value={cricketForm.format} onChange={e => setCricketForm(p => ({...p, format: e.target.value}))} className="bg-background border px-1 py-1">
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="Test">Test</option>
            </select>
            <input type="number" placeholder="Max Overs" value={cricketForm.maxOvers} onChange={e => setCricketForm(p => ({...p, maxOvers: e.target.value}))} className="bg-background border px-1 py-1" />
          </div>`;

const newRecordMatchForm = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })
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
          </div>`;

code = code.replace(oldRecordMatchForm, newRecordMatchForm);

// Inject the Toss UI into RecordMatchForm for Cricket
const oldCricketTeamSetup = `          <div className="grid grid-cols-2 gap-4">
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
        </div>
      )}`;

const newCricketTeamSetup = `          <div className="grid grid-cols-2 gap-4">
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
              {tossWinner ? \`\${tossWinner} won the toss & elected to \${tossDecision === 'Bat' ? 'bat' : 'field'}\` : 'No toss simulated'}
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
      )}`;

code = code.replace(oldCricketTeamSetup, newCricketTeamSetup);

fs.writeFileSync(path, code);
console.log("Patched components/games/game-tracker.tsx with Cricket Toss & Restrict Batter/Bowler");
