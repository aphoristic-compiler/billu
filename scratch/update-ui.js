const fs = require('fs');
const path = require('path');

const file = path.join('E:', 'code', 'billu', 'components', 'games', 'game-tracker.tsx');
let code = fs.readFileSync(file, 'utf8');

// Add deleteMatch import
code = code.replace(/logPokerLedger } from '@\/lib\/actions\/matches'/, "logPokerLedger, deleteMatch } from '@/lib/actions/matches'");

// Rewrite OngoingMatchCard
const newOngoingMatchCard = `function OngoingMatchCard({ match, members }: any) {
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
}`;

code = code.replace(/function OngoingMatchCard\(\{ match, members \}: any\) \{[\s\S]*?    <\/div>\n  \)\n\}/, newOngoingMatchCard);

fs.writeFileSync(file, code, 'utf8');
console.log('Successfully updated game-tracker.tsx');
