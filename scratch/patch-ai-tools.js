const fs = require('fs');

let code = fs.readFileSync('E:/code/billu/lib/actions/ai-tools.ts', 'utf8');

const newTools = `
  {
    type: 'function',
    function: {
      name: 'log_cricket_stats',
      description: 'Log a cricket over, runs, and wickets incrementally for an ongoing match. You MUST state the remaining overs and runs to win if the second inning is happening.',
      parameters: {
        type: 'object',
        properties: {
          battingPlayer: { type: 'string', description: 'Username or real name of the batter.' },
          bowlingPlayer: { type: 'string', description: 'Username or real name of the bowler.' },
          runsScored: { type: 'number', description: 'Runs scored by the batter in this over/instance.' },
          wicketsFallen: { type: 'number', description: 'Wickets taken by the bowler.' },
          oversBowled: { type: 'number', description: 'Overs bowled in this entry (e.g. 1).' },
          inningNumber: { type: 'number', description: '1 or 2.' }
        },
        required: ['battingPlayer', 'bowlingPlayer', 'runsScored', 'wicketsFallen', 'oversBowled', 'inningNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_cards_round',
      description: 'Log a finished round of cards.',
      parameters: {
        type: 'object',
        properties: {
          roundNumber: { type: 'number' },
          participants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                hands_made: { type: 'number' }
              },
              required: ['username', 'hands_made']
            }
          }
        },
        required: ['roundNumber', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_badminton_set',
      description: 'Log a finished badminton set.',
      parameters: {
        type: 'object',
        properties: {
          setNumber: { type: 'number' },
          participants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                score: { type: 'number' },
                isWinner: { type: 'boolean' }
              },
              required: ['username', 'score', 'isWinner']
            }
          }
        },
        required: ['setNumber', 'participants']
      }
    }
  },
`;

code = code.replace(/export const ALL_TOOLS: any\[\] = \[/, "export const ALL_TOOLS: any[] = [" + newTools);

const newSwitchCases = `
        case 'log_cricket_stats': return await ai_log_cricket_stats(args);
        case 'log_cards_round': return await ai_log_cards_round(args);
        case 'log_badminton_set': return await ai_log_badminton_set(args);
`;

code = code.replace(/case 'add_game_match':/, newSwitchCases + "\n        case 'add_game_match':");

const newFunctions = `
import { addMatchRound } from '@/lib/actions/matches'

async function ai_log_cricket_stats(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true, rounds: { with: { stats: true } } } });
    const cricketMatch = ongoingMatches.find(m => m.game?.name === 'Cricket');
    if (!cricketMatch) return JSON.stringify({ error: 'No ongoing cricket match found.' });

    const batter = await db.query.users.findFirst({ where: or(eq(users.username, args.battingPlayer.replace('@', '')), ilike(users.displayName, \`%\${args.battingPlayer.replace('@', '')}%\`)) });
    const bowler = await db.query.users.findFirst({ where: or(eq(users.username, args.bowlingPlayer.replace('@', '')), ilike(users.displayName, \`%\${args.bowlingPlayer.replace('@', '')}%\`)) });

    if (!batter) return JSON.stringify({ error: \`Batter \${args.battingPlayer} not found.\` });
    if (!bowler) return JSON.stringify({ error: \`Bowler \${args.bowlingPlayer} not found.\` });

    await addMatchRound({
      matchId: cricketMatch.id,
      roundNumber: args.inningNumber,
      type: 'inning',
      participants: [
        { userId: batter.id, role: 'batting', stats: { runs: args.runsScored } },
        { userId: bowler.id, role: 'bowling', stats: { overs: args.oversBowled, wickets: args.wicketsFallen, runs_given: args.runsScored } }
      ]
    });

    let extraInfo = '';
    // Let's recalculate the remaining overs and runs if it's inning 2
    if (args.inningNumber === 2 && cricketMatch.rounds) {
      let targetRuns = 0;
      let currRuns = args.runsScored;
      let totalOversBowled = args.oversBowled;
      
      for (const r of cricketMatch.rounds) {
        if (r.roundNumber === 1) {
          for (const s of r.stats) {
            if (s.role === 'batting') targetRuns += (Number(s.stats.runs) || 0);
          }
        } else if (r.roundNumber === 2) {
          for (const s of r.stats) {
            if (s.role === 'batting') currRuns += (Number(s.stats.runs) || 0);
            if (s.role === 'bowling') totalOversBowled += (Number(s.stats.overs) || 0);
          }
        }
      }
      targetRuns += 1; // score to win
      const oversLeft = (cricketMatch.maxOvers || 20) - totalOversBowled;
      const runsToWin = targetRuns - currRuns;
      extraInfo = \` The target is \${targetRuns}. They need \${runsToWin} runs to win in \${oversLeft} overs.\`;
    }

    return JSON.stringify({ message: \`Logged \${args.runsScored} runs for \${batter.displayName}, and \${args.wicketsFallen} wickets in \${args.oversBowled} overs for \${bowler.displayName}.\` + extraInfo });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_log_cards_round(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const cardsMatch = ongoingMatches.find(m => m.game?.name === 'Cards');
    if (!cardsMatch) return JSON.stringify({ error: 'No ongoing cards match found.' });

    const participantsData = [];
    for (const p of args.participants) {
      const u = await db.query.users.findFirst({ where: or(eq(users.username, p.username.replace('@', '')), ilike(users.displayName, \`%\${p.username.replace('@', '')}%\`)) });
      if (u) {
        participantsData.push({
          userId: u.id,
          stats: { hands_made: p.hands_made }
        });
      }
    }

    if (participantsData.length === 0) return JSON.stringify({ error: "No valid participants found." });

    await addMatchRound({
      matchId: cardsMatch.id,
      roundNumber: args.roundNumber,
      type: 'round',
      participants: participantsData
    });

    return JSON.stringify({ message: \`Logged card round \${args.roundNumber} successfully.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_log_badminton_set(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const badmintonMatch = ongoingMatches.find(m => m.game?.name === 'Badminton');
    if (!badmintonMatch) return JSON.stringify({ error: 'No ongoing badminton match found.' });

    const participantsData = [];
    for (const p of args.participants) {
      const u = await db.query.users.findFirst({ where: or(eq(users.username, p.username.replace('@', '')), ilike(users.displayName, \`%\${p.username.replace('@', '')}%\`)) });
      if (u) {
        participantsData.push({
          userId: u.id,
          isWinner: p.isWinner,
          stats: { score: p.score }
        });
      }
    }

    if (participantsData.length === 0) return JSON.stringify({ error: "No valid participants found." });

    await addMatchRound({
      matchId: badmintonMatch.id,
      roundNumber: args.setNumber,
      type: 'set',
      participants: participantsData
    });

    return JSON.stringify({ message: \`Logged badminton set \${args.setNumber} successfully.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}
`;

code = code.replace(/async function ai_add_game_match/, newFunctions + "\nasync function ai_add_game_match");

fs.writeFileSync('E:/code/billu/lib/actions/ai-tools.ts', code);
console.log('AI tools patched');
