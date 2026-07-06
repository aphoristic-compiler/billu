const fs = require('fs');
const path = require('path');

const schemaFile = path.join('E:', 'code', 'billu', 'lib', 'db', 'schema.ts');
let schemaCode = fs.readFileSync(schemaFile, 'utf8');

// Badminton Schema Update
const newBadmintonSchema = `export const badmintonSets = pgTable("badminton_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  
  team1Player1Id: uuid("team_1_p1_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  team1Player2Id: uuid("team_1_p2_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
  score1: integer("score_1").notNull(),
  
  team2Player1Id: uuid("team_2_p1_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  team2Player2Id: uuid("team_2_p2_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
  score2: integer("score_2").notNull(),
  
  winnerId: uuid("winner_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
})`;

schemaCode = schemaCode.replace(/export const badmintonSets = pgTable\("badminton_sets", \{[\s\S]*?\}\)/, newBadmintonSchema);

const newBadmintonRelations = `export const badmintonSetsRelations = relations(badmintonSets, ({ one }) => ({
  match: one(matches, { fields: [badmintonSets.matchId], references: [matches.id] }),
  team1Player1: one(matchParticipants, { fields: [badmintonSets.team1Player1Id], references: [matchParticipants.id], relationName: 't1p1' }),
  team1Player2: one(matchParticipants, { fields: [badmintonSets.team1Player2Id], references: [matchParticipants.id], relationName: 't1p2' }),
  team2Player1: one(matchParticipants, { fields: [badmintonSets.team2Player1Id], references: [matchParticipants.id], relationName: 't2p1' }),
  team2Player2: one(matchParticipants, { fields: [badmintonSets.team2Player2Id], references: [matchParticipants.id], relationName: 't2p2' }),
  winner: one(matchParticipants, { fields: [badmintonSets.winnerId], references: [matchParticipants.id], relationName: 'winner' }),
}))`;

schemaCode = schemaCode.replace(/export const badmintonSetsRelations = relations\(badmintonSets, \(\{ one \}\) => \(\{[\s\S]*?\}\)\)/, newBadmintonRelations);

fs.writeFileSync(schemaFile, schemaCode, 'utf8');
console.log('Successfully updated schema.ts');

const matchesFile = path.join('E:', 'code', 'billu', 'lib', 'actions', 'matches.ts');
let matchesCode = fs.readFileSync(matchesFile, 'utf8');

// Fix logMatch missing createdBy
matchesCode = matchesCode.replace(/status: input\.status \|\| 'completed',\n\s*notes: input\.notes,/, "status: input.status || 'completed',\n        notes: input.notes,\n        createdBy: user.id,");

// Update logBadmintonSet
const newLogBadminton = `export async function logBadmintonSet(matchId: string, setNumber: number, team1: string[], score1: number, team2: string[], score2: number) {
  const mp1_1 = await getOrCreateParticipant(matchId, team1[0])
  const mp1_2 = team1[1] ? await getOrCreateParticipant(matchId, team1[1]) : null
  const mp2_1 = await getOrCreateParticipant(matchId, team2[0])
  const mp2_2 = team2[1] ? await getOrCreateParticipant(matchId, team2[1]) : null

  // Winner logic: pick team 1 or team 2 based on score, we just set the first player as the "winnerId" for simplicity in determining match outcome later, or we can use another method. 
  // Wait, if it's doubles, we just need a way to track set wins. Let's just track the first player of the winning team.
  const winnerId = score1 > score2 ? mp1_1.id : score2 > score1 ? mp2_1.id : null

  await db.insert(badmintonSets).values({
    matchId,
    setNumber,
    team1Player1Id: mp1_1.id,
    team1Player2Id: mp1_2?.id,
    score1,
    team2Player1Id: mp2_1.id,
    team2Player2Id: mp2_2?.id,
    score2,
    winnerId
  })
}`;

matchesCode = matchesCode.replace(/export async function logBadmintonSet[\s\S]*?\}\s*export async function logCardsRound/, newLogBadminton + '\n\nexport async function logCardsRound');

fs.writeFileSync(matchesFile, matchesCode, 'utf8');
console.log('Successfully updated matches.ts');

const aiToolsFile = path.join('E:', 'code', 'billu', 'lib', 'actions', 'ai-tools.ts');
let aiToolsCode = fs.readFileSync(aiToolsFile, 'utf8');

const newAiBadminton = `async function ai_log_badminton_set(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const badmintonMatch = ongoingMatches.find(m => m.game?.name === 'Badminton');
    if (!badmintonMatch) return JSON.stringify({ error: 'No ongoing badminton match found.' });

    const resolveUser = async (username: string) => {
      if (!username) return null;
      return await db.query.users.findFirst({ where: or(eq(users.username, username.replace('@', '')), ilike(users.displayName, \`%\${username.replace('@', '')}%\`)) });
    }

    const t1p1 = await resolveUser(args.team1Player1);
    const t1p2 = await resolveUser(args.team1Player2);
    const t2p1 = await resolveUser(args.team2Player1);
    const t2p2 = await resolveUser(args.team2Player2);

    if (!t1p1 || !t2p1) return JSON.stringify({ error: "At least one player per team is required." });

    const team1 = [t1p1.id];
    if (t1p2) team1.push(t1p2.id);
    const team2 = [t2p1.id];
    if (t2p2) team2.push(t2p2.id);

    await logBadmintonSet(badmintonMatch.id, args.setNumber, team1, args.team1Score, team2, args.team2Score);

    return JSON.stringify({ message: \`Logged badminton set \${args.setNumber} successfully.\` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}`;

aiToolsCode = aiToolsCode.replace(/async function ai_log_badminton_set[\s\S]*?catch \(err: any\) \{\s*return JSON\.stringify\(\{ error: err\.message \}\);\s*\}\s*\}/, newAiBadminton);

fs.writeFileSync(aiToolsFile, aiToolsCode, 'utf8');
console.log('Successfully updated ai-tools.ts');
