const fs = require('fs');
const path = require('path');

const schemaPath = path.join('E:', 'code', 'billu', 'lib', 'actions', 'ai-tools.ts');
let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Replace ai_log_cricket_stats
const newCricketStats = `async function ai_log_cricket_stats(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true, cricketMatches: { with: { innings: true } } } });
    const cricketMatch = ongoingMatches.find(m => m.game?.name === 'Cricket');
    if (!cricketMatch) return JSON.stringify({ error: 'No ongoing cricket match found.' });

    const batter = await db.query.users.findFirst({ where: or(eq(users.username, args.battingPlayer.replace('@', '')), ilike(users.displayName, \`%\${args.battingPlayer.replace('@', '')}%\`)) });
    const bowler = await db.query.users.findFirst({ where: or(eq(users.username, args.bowlingPlayer.replace('@', '')), ilike(users.displayName, \`%\${args.bowlingPlayer.replace('@', '')}%\`)) });

    if (!batter) return JSON.stringify({ error: \`Batter \${args.battingPlayer} not found.\` });
    if (!bowler) return JSON.stringify({ error: \`Bowler \${args.bowlingPlayer} not found.\` });

    await logCricketBatter(cricketMatch.id, args.inningNumber, batter.id, args.runsScored, args.ballsFaced || 0, false);
    await logCricketOver(cricketMatch.id, args.inningNumber, bowler.id, args.runsScored, args.wicketsFallen);

    return JSON.stringify({ message: \`Logged \${args.runsScored} runs for \${batter.displayName}, and \${args.wicketsFallen} wickets for \${bowler.displayName}.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}`;

schemaContent = schemaContent.replace(/async function ai_log_cricket_stats\(args: any\) \{[\s\S]*?catch \(err: any\) \{\s*return JSON\.stringify\(\{ error: err\.message \}\);\s*\}\s*\}/, newCricketStats);

// Replace ai_log_cards_round
const newCardsStats = `async function ai_log_cards_round(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const cardsMatch = ongoingMatches.find(m => m.game?.name === 'Cards');
    if (!cardsMatch) return JSON.stringify({ error: 'No ongoing cards match found.' });

    const participantsData = [];
    for (const p of args.participants) {
      const user = await db.query.users.findFirst({ where: or(eq(users.username, p.playerName.replace('@', '')), ilike(users.displayName, \`%\${p.playerName.replace('@', '')}%\`)) });
      if (user) {
        participantsData.push({ userId: user.id, handsMade: p.handsMade });
      }
    }

    if (participantsData.length === 0) return JSON.stringify({ error: "No valid participants found." });

    await logCardsRound(cardsMatch.id, args.roundNumber, participantsData);

    return JSON.stringify({ message: \`Logged card round \${args.roundNumber} successfully.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}`;

schemaContent = schemaContent.replace(/async function ai_log_cards_round\(args: any\) \{[\s\S]*?catch \(err: any\) \{\s*return JSON\.stringify\(\{ error: err\.message \}\);\s*\}\s*\}/, newCardsStats);

// Replace ai_log_badminton_set
const newBadmintonStats = `async function ai_log_badminton_set(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const badmintonMatch = ongoingMatches.find(m => m.game?.name === 'Badminton');
    if (!badmintonMatch) return JSON.stringify({ error: 'No ongoing badminton match found.' });

    const p1 = await db.query.users.findFirst({ where: or(eq(users.username, args.team1Player.replace('@', '')), ilike(users.displayName, \`%\${args.team1Player.replace('@', '')}%\`)) });
    const p2 = await db.query.users.findFirst({ where: or(eq(users.username, args.team2Player.replace('@', '')), ilike(users.displayName, \`%\${args.team2Player.replace('@', '')}%\`)) });

    if (!p1 || !p2) return JSON.stringify({ error: "Players not found." });

    await logBadmintonSet(badmintonMatch.id, args.setNumber, p1.id, args.team1Score, p2.id, args.team2Score);

    return JSON.stringify({ message: \`Logged badminton set \${args.setNumber} successfully.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}`;

schemaContent = schemaContent.replace(/async function ai_log_badminton_set\(args: any\) \{[\s\S]*?catch \(err: any\) \{\s*return JSON\.stringify\(\{ error: err\.message \}\);\s*\}\s*\}/, newBadmintonStats);

fs.writeFileSync(schemaPath, schemaContent, 'utf8');
console.log('Successfully rewritten ai-tools.ts');
