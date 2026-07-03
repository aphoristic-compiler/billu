'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { getMatches, getLeaderboard, recordMatch } from '@/lib/actions/matches';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';

export default function GamesPage() {
  const { user } = useUser();
  const [matches, setMatches] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    game: 'tennis',
    winners: [] as string[],
    losers: [] as string[],
    scoreWinner: 0,
    scoreLoser: 0,
    pokerBuyIn: 0,
    pokerPayout: 0,
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      const [m, l] = await Promise.all([getMatches(), getLeaderboard()]);
      setMatches(m);
      setLeaderboard(l);
    };
    load();
  }, []);

  if (!user) return null;

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await recordMatch({
        game: formData.game as any,
        winners: formData.winners,
        losers: formData.losers,
        scoreWinner: formData.game !== 'poker' ? formData.scoreWinner : 0,
        scoreLoser: formData.game !== 'poker' ? formData.scoreLoser : 0,
        pokerBuyIn: formData.game === 'poker' ? formData.pokerBuyIn : 0,
        pokerPayout: formData.game === 'poker' ? formData.pokerPayout : 0,
        notes: formData.notes,
      });
      toast('MATCH_RECORDED', 'success');
      const [m, l] = await Promise.all([getMatches(), getLeaderboard()]);
      setMatches(m);
      setLeaderboard(l);
      setFormData({ game: 'tennis', winners: [], losers: [], scoreWinner: 0, scoreLoser: 0, pokerBuyIn: 0, pokerPayout: 0, notes: '' });
      setShowForm(false);
    } catch (err) {
      toast('RECORD_FAILED', 'warning');
    } finally {
      setLoading(false);
    }
  };

  const topPlayers = leaderboard.slice(0, 5);

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="border border-accent/30 bg-background/50 p-4">
        <h2 className="mb-3 text-accent">GAME_TRACKER</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-secondary">TOTAL_MATCHES</p>
            <p className="text-xl font-bold text-accent">{matches.length}</p>
          </div>
          <div>
            <p className="text-secondary">YOUR_RECORD</p>
            <p className="text-xl font-bold text-accent">
              {matches.filter((m: any) => m.winners.includes(user.id)).length}-
              {matches.filter((m: any) => m.losers.includes(user.id)).length}
            </p>
          </div>
          <div>
            <p className="text-secondary">POKER_PNL</p>
            <p className={`text-xl font-bold ${leaderboard.find((l: any) => l.userId === user.id)?.pokerPnl > 0 ? 'text-success' : 'text-warning'}`}>
              {(leaderboard.find((l: any) => l.userId === user.id)?.pokerPnl || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full border border-accent/30 bg-background/50 p-2 text-secondary hover:border-accent hover:text-accent"
      >
        {showForm ? '[−] RECORD_MATCH' : '[+] RECORD_MATCH'}
      </button>

      {showForm && (
        <form onSubmit={handleRecord} className="border border-accent/30 bg-background/50 p-4 space-y-2">
          <div>
            <label className="block text-secondary">GAME_TYPE</label>
            <select
              value={formData.game}
              onChange={e => setFormData(prev => ({ ...prev, game: e.target.value }))}
              className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
            >
              <option value="tennis">Tennis</option>
              <option value="badminton">Badminton</option>
              <option value="football">Football</option>
              <option value="poker">Poker</option>
            </select>
          </div>

          {formData.game !== 'poker' ? (
            <>
              <div>
                <label className="block text-secondary">WINNER_SCORE</label>
                <input
                  type="number"
                  value={formData.scoreWinner}
                  onChange={e => setFormData(prev => ({ ...prev, scoreWinner: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-secondary">LOSER_SCORE</label>
                <input
                  type="number"
                  value={formData.scoreLoser}
                  onChange={e => setFormData(prev => ({ ...prev, scoreLoser: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-secondary">BUY_IN</label>
                <input
                  type="number"
                  value={formData.pokerBuyIn}
                  onChange={e => setFormData(prev => ({ ...prev, pokerBuyIn: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-secondary">PAYOUT</label>
                <input
                  type="number"
                  value={formData.pokerPayout}
                  onChange={e => setFormData(prev => ({ ...prev, pokerPayout: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
                  step="0.01"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-secondary">NOTES</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
              rows={2}
              placeholder="Optional"
            />
          </div>

          <CandlestickButton onClick={handleRecord} isLoading={loading} className="w-full">
            {loading ? 'RECORDING...' : 'RECORD'}
          </CandlestickButton>
        </form>
      )}

      {topPlayers.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">LEADERBOARD</h3>
          <div className="space-y-1">
            {topPlayers.map((player, i) => (
              <div key={i} className="flex items-center justify-between border-b border-accent/10 pb-1">
                <span className="text-accent">#{i + 1}</span>
                <span className="text-secondary">{player.userId}</span>
                <span className="text-tertiary">{player.wins}W {player.losses}L</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">RECENT_MATCHES</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {matches.slice(0, 10).map((match, i) => (
              <div key={i} className="border-l-2 border-accent/10 pl-2 text-tertiary text-xs">
                <p className="text-accent">{match.game.toUpperCase()}</p>
                <p>{match.winners.join(', ')} vs {match.losers.join(', ')}</p>
                {match.notes && <p className="italic">{match.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
