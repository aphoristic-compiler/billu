const fs = require('fs');

const path = 'components/games/game-tracker.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add useEffect to React imports
code = code.replace(
  "import { useMemo, useState, useTransition } from 'react'",
  "import { useMemo, useState, useTransition, useEffect } from 'react'"
);

// 2. Replace CricketScorecard
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
            {getTarget(inning, idx) !== null && <span className="text-xs text-profit font-bold">Target: {getTarget(inning, idx)}</span>}
          </p>
          <p className="text-accent text-lg">{inning.totalRuns}/{inning.totalWickets} <span className="text-xs text-muted-foreground">({inning.totalOvers.toFixed(1)} Ov)</span></p>
          {inning.isDeclared && <p className="text-[10px] text-profit border border-profit px-1 inline-block mt-1">DECLARED</p>}
        </div>
      ))}
    </div>
  )
}`;

code = code.replace(oldScorecard, newScorecard);

// 3. Inject useEffect inside LogRoundForm
const oldLogRoundStart = `  const cm = match.cricketMatches?.[0]
  const battingFirstTeam = cm?.battingFirst
  const team1Name = cm?.team1Name
  const team2Name = cm?.team2Name

  const currentBattingTeam = inningNumber === 1 ? battingFirstTeam : (battingFirstTeam === team1Name ? team2Name : team1Name);
  const currentBowlingTeam = inningNumber === 1 ? (battingFirstTeam === team1Name ? team2Name : team1Name) : battingFirstTeam;

  const battingPlayers = match.participants?.filter((p: any) => p.teamName === currentBattingTeam) || []
  const bowlingPlayers = match.participants?.filter((p: any) => p.teamName === currentBowlingTeam) || []`;

const newLogRoundStart = `  const cm = match.cricketMatches?.[0]
  const battingFirstTeam = cm?.battingFirst
  const team1Name = cm?.team1Name
  const team2Name = cm?.team2Name

  const currentBattingTeam = inningNumber === 1 ? battingFirstTeam : (battingFirstTeam === team1Name ? team2Name : team1Name);
  const currentBowlingTeam = inningNumber === 1 ? (battingFirstTeam === team1Name ? team2Name : team1Name) : battingFirstTeam;

  const battingPlayers = match.participants?.filter((p: any) => p.teamName === currentBattingTeam) || []
  const bowlingPlayers = match.participants?.filter((p: any) => p.teamName === currentBowlingTeam) || []

  // Auto switch inning based on wickets and overs
  useEffect(() => {
    if (!cm || !cm.innings || cm.innings.length === 0) return;
    const sorted = [...cm.innings].sort((a, b) => b.inningNumber - a.inningNumber);
    const latest = sorted[0];
    
    const battingTeamPlayersCount = match.participants?.filter((p: any) => p.teamName === latest.battingTeam).length || 11;
    const maxWickets = Math.max(1, Math.min(10, battingTeamPlayersCount - 1));
    
    const isAllOut = latest.totalWickets >= maxWickets;
    const isMaxOvers = latest.totalOvers >= (cm.maxOvers || 20);
    
    if (latest.inningNumber === 1 && (isAllOut || isMaxOvers || latest.isCompleted)) {
      setInningNumber(2);
    } else {
      setInningNumber(latest.inningNumber);
    }
  }, [match, cm]);`;

code = code.replace(oldLogRoundStart, newLogRoundStart);


// 4. Update RecordMatchForm toss simulation & locking
const oldRecordMatchFormSetup = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })
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
  }`;

const newRecordMatchFormSetup = `  const [cricketForm, setCricketForm] = useState({ format: 'T20', maxOvers: '20', team1: 'Team A', team2: 'Team B' })
  const [team1Members, setTeam1Members] = useState<string[]>([])
  const [team2Members, setTeam2Members] = useState<string[]>([])
  const [tossWinner, setTossWinner] = useState('')
  const [tossDecision, setTossDecision] = useState('Bat')
  const [battingFirst, setBattingFirst] = useState('')
  const [tossWasSimulated, setTossWasSimulated] = useState(false)

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
    setTossWinner(winner);
    setTossWasSimulated(true);
  }`;

code = code.replace(oldRecordMatchFormSetup, newRecordMatchFormSetup);


// Update selectors for toss locking & roasting
const oldTossSelectors = `          <div className="grid grid-cols-2 gap-2 mt-4 border-t border-border/50 pt-2">
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
          </div>`;

const newTossSelectors = `          <div className="grid grid-cols-2 gap-2 mt-4 border-t border-border/50 pt-2">
            <div>
              <label className="block text-accent mb-1 font-bold">Toss Winner</label>
              <select value={tossWinner} onChange={e => {
                if (tossWasSimulated) {
                  toast("Nice try, fraud. The toss was simulated. Play fair or go home.", "error");
                  return;
                }
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
              {tossWinner ? \`\${tossWinner} won the toss\` : 'No toss simulated'}
            </div>
          </div>`;

code = code.replace(oldTossSelectors, newTossSelectors);

fs.writeFileSync(path, code);
console.log("Patched game-tracker.tsx");
