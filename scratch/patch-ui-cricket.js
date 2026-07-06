const fs = require('fs');

const path = 'components/games/game-tracker.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update CricketScorecard
const oldScorecard = `function CricketScorecard({ match }: any) {
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
  }`;

const newScorecard = `function CricketScorecard({ match }: any) {
    const cm = match.cricketMatches?.[0]
    if (!cm) return null
    
    // Calculate target for chasing innings
    const getTarget = (currentInning: any, index: number) => {
       if (index > 0 && cm.innings[index - 1]) {
         return cm.innings[index - 1].totalRuns + 1;
       }
       return null;
    }
    
    return (
      <div className="mt-2 text-muted-foreground">
        <p className="font-bold mb-1">Format: {cm.format} ({cm.maxOvers} Overs)</p>
        {cm.innings?.map((inning: any, idx: number) => (
          <div key={inning.id} className="mb-2 p-2 bg-background border border-border rounded">
            <p className="text-foreground font-bold flex justify-between">
              <span>Inning {inning.inningNumber} ({inning.battingTeam} vs {inning.bowlingTeam})</span>
              {getTarget(inning, idx) !== null && <span className="text-xs text-profit">Target: {getTarget(inning, idx)}</span>}
            </p>
            <p className="text-accent text-lg">{inning.totalRuns}/{inning.totalWickets} <span className="text-xs text-muted-foreground">({inning.totalOvers.toFixed(1)} Ov)</span></p>
            {inning.isDeclared && <p className="text-[10px] text-profit border border-profit px-1 inline-block mt-1">DECLARED</p>}
          </div>
        ))}
      </div>
    )
  }`;

code = code.replace(oldScorecard, newScorecard);


// 2. Update RecordMatchForm
const oldRecordMatchForm = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })

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
      )}`;

const newRecordMatchForm = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })
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
        </div>
      )}`;

code = code.replace(oldRecordMatchForm, newRecordMatchForm);

fs.writeFileSync(path, code);
console.log("Patched components/games/game-tracker.tsx");
