const fs = require('fs');

const path = 'lib/actions/ai-tools.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Insert query_ongoing_matches schema into aiToolsConfig
const oldSchemaEnd = `  {
    type: 'function',
    function: {
      name: 'log_badminton_set',
      description: 'Log a finished badminton set (supports doubles/singles).',
      parameters: {
        type: 'object',
        properties: {
          setNumber: { type: 'number' },
          team1Player1: { type: 'string', description: 'Username or display name of first player on team 1.' },
          team1Player2: { type: 'string', description: 'Username or display name of second player on team 1 (optional).' },
          team1Score: { type: 'number' },
          team2Player1: { type: 'string', description: 'Username or display name of first player on team 2.' },
          team2Player2: { type: 'string', description: 'Username or display name of second player on team 2 (optional).' },
          team2Score: { type: 'number' }
        },
        required: ['setNumber', 'team1Player1', 'team1Score', 'team2Player1', 'team2Score']
      }
    }
  }
];`;

const newSchemaEnd = `  {
    type: 'function',
    function: {
      name: 'log_badminton_set',
      description: 'Log a finished badminton set (supports doubles/singles).',
      parameters: {
        type: 'object',
        properties: {
          setNumber: { type: 'number' },
          team1Player1: { type: 'string', description: 'Username or display name of first player on team 1.' },
          team1Player2: { type: 'string', description: 'Username or display name of second player on team 1 (optional).' },
          team1Score: { type: 'number' },
          team2Player1: { type: 'string', description: 'Username or display name of first player on team 2.' },
          team2Player2: { type: 'string', description: 'Username or display name of second player on team 2 (optional).' },
          team2Score: { type: 'number' }
        },
        required: ['setNumber', 'team1Player1', 'team1Score', 'team2Player1', 'team2Score']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_ongoing_matches',
      description: 'Fetch all active/ongoing matches currently being played (e.g. Cricket, Badminton, Cards, Poker). Use this to see what matches are currently live.',
      parameters: { type: 'object', properties: {} }
    }
  }
];`;

code = code.replace(oldSchemaEnd, newSchemaEnd);


// 2. Insert case in executeAiTool
const oldSwitchCase = `      case 'query_polls': return await query_polls();`;
const newSwitchCase = `      case 'query_polls': return await query_polls();
      case 'query_ongoing_matches': return await query_ongoing_matches();`;

code = code.replace(oldSwitchCase, newSwitchCase);


// 3. Insert query_ongoing_matches function implementation
const oldFunctionAnchor = `async function query_polls() {
  const activePolls = await db.query.polls.findMany({ with: { creator: true, options: { with: { votes: { with: { user: true } } } } } });
  if (activePolls.length === 0) return JSON.stringify({ message: "No active market surveys." });
  return JSON.stringify(activePolls.map((p: any) => ({
    question: p.question, creator: p.creator?.username, isPinned: p.isPinned, isAnonymous: p.isAnonymous,
    options: p.options.map((o: any) => ({ 
      label: o.label, 
      votes: o.votes.length, 
      voters: p.isAnonymous ? ['REDACTED (anonymous)'] : o.votes.map((v: any) => v.user?.username) 
    }))
  })));
}`;

const newFunctionAnchor = `async function query_polls() {
  const activePolls = await db.query.polls.findMany({ with: { creator: true, options: { with: { votes: { with: { user: true } } } } } });
  if (activePolls.length === 0) return JSON.stringify({ message: "No active market surveys." });
  return JSON.stringify(activePolls.map((p: any) => ({
    question: p.question, creator: p.creator?.username, isPinned: p.isPinned, isAnonymous: p.isAnonymous,
    options: p.options.map((o: any) => ({ 
      label: o.label, 
      votes: o.votes.length, 
      voters: p.isAnonymous ? ['REDACTED (anonymous)'] : o.votes.map((v: any) => v.user?.username) 
    }))
  })));
}

async function query_ongoing_matches() {
  const ongoing = await db.query.matches.findMany({
    where: eq(matches.status, 'ongoing'),
    with: { game: true, participants: { with: { user: true } }, cricketMatches: true }
  });
  if (ongoing.length === 0) return JSON.stringify({ message: "No ongoing matches right now." });
  return JSON.stringify(ongoing.map((m: any) => ({
    id: m.id,
    game: m.game?.name,
    notes: m.notes,
    playedAt: m.playedAt,
    cricketDetails: m.cricketMatches?.[0] ? {
      format: m.cricketMatches[0].format,
      maxOvers: m.cricketMatches[0].maxOvers,
      team1Name: m.cricketMatches[0].team1Name,
      team2Name: m.cricketMatches[0].team2Name,
      tossWinner: m.cricketMatches[0].tossWinner,
      battingFirst: m.cricketMatches[0].battingFirst
    } : null,
    participants: m.participants.map((p: any) => ({
      username: p.user?.username,
      teamName: p.teamName
    }))
  })));
}`;

code = code.replace(oldFunctionAnchor, newFunctionAnchor);

fs.writeFileSync(path, code);
console.log("Patched lib/actions/ai-tools.ts successfully");
