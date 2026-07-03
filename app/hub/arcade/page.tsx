'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { getArcadeGames, generateGame, recordArcadeScore, getArcadeLeaderboard } from '@/lib/actions/arcade';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';

export default function ArcadePage() {
  const { user } = useUser();
  const [games, setGames] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [score, setScore] = useState(0);
  const [submittingScore, setSubmittingScore] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const [g, l] = await Promise.all([getArcadeGames(), getArcadeLeaderboard()]);
      setGames(g);
      setLeaderboard(l);
    };
    load();
  }, [user]);

  if (!user) return null;

  const handleGenerateGame = async () => {
    setGenerating(true);
    try {
      const newGame = await generateGame();
      toast('GAME_GENERATED', 'success');
      const g = await getArcadeGames();
      setGames(g);
      setSelectedGame(newGame);
      setScore(0);
    } catch (err) {
      toast('GENERATION_FAILED', 'warning');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitScore = async () => {
    if (!selectedGame || score <= 0) return;
    setSubmittingScore(true);
    try {
      await recordArcadeScore(selectedGame.id, score);
      toast(`SCORE_${score}_RECORDED`, 'success');
      const l = await getArcadeLeaderboard();
      setLeaderboard(l);
      setScore(0);
    } catch (err) {
      toast('SUBMIT_FAILED', 'warning');
    } finally {
      setSubmittingScore(false);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="border border-accent/30 bg-background/50 p-4">
        <h2 className="mb-3 text-accent">AI_ARCADE</h2>
        <p className="text-secondary mb-3">Dynamically generated games powered by Gemini</p>

        <CandlestickButton onClick={handleGenerateGame} isLoading={generating} className="w-full">
          {generating ? 'GENERATING...' : 'GENERATE_NEW_GAME'}
        </CandlestickButton>
      </div>

      {selectedGame && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">NOW_PLAYING</h3>
          <p className="text-secondary mb-2">{selectedGame.title}</p>
          <p className="text-tertiary mb-3 italic">{selectedGame.description}</p>

          <div className="mb-3 border-t border-accent/10 pt-3">
            <p className="text-secondary mb-2">GAME_IFRAME</p>
            <div className="border border-accent/20 bg-black aspect-video overflow-hidden">
              {selectedGame.htmlContent ? (
                <iframe
                  srcDoc={selectedGame.htmlContent}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts"
                  title="Game"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-tertiary">
                  [Game content loading...]
                </div>
              )}
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-secondary mb-1">YOUR_SCORE</label>
            <input
              type="number"
              value={score}
              onChange={e => setScore(parseInt(e.target.value) || 0)}
              className="w-full border border-accent/30 bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
              min="0"
            />
          </div>

          <CandlestickButton
            onClick={handleSubmitScore}
            isLoading={submittingScore}
            disabled={score <= 0}
            className="w-full"
          >
            {submittingScore ? 'SUBMITTING...' : 'SUBMIT_SCORE'}
          </CandlestickButton>
        </div>
      )}

      {games.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">GENERATED_GAMES ({games.length})</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {games.map((g, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedGame(g);
                  setScore(0);
                }}
                className={`block w-full border text-left px-2 py-1 transition ${selectedGame?.id === g.id ? 'border-accent bg-accent/10 text-accent' : 'border-accent/30 hover:border-accent'}`}
              >
                {g.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">ARCADE_LEADERBOARD</h3>
          <div className="space-y-1">
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div key={i} className="flex items-center justify-between border-b border-accent/10 pb-1">
                <span className="text-accent">#{i + 1}</span>
                <span className="text-secondary">{entry.userId}</span>
                <span className="text-success">{entry.highScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
