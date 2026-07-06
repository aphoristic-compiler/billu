const fs = require('fs');
const path = require('path');

const schemaFile = path.join('E:', 'code', 'billu', 'lib', 'db', 'schema.ts');
let schemaCode = fs.readFileSync(schemaFile, 'utf8');

// Undo the rename so drizzle-kit push doesn't get confused
const newBadmintonSchema = `export const badmintonSets = pgTable("badminton_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  
  player1Id: uuid("player_1_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  team1Player2Id: uuid("team_1_p2_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
  score1: integer("score_1").notNull(),
  
  player2Id: uuid("player_2_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  team2Player2Id: uuid("team_2_p2_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
  score2: integer("score_2").notNull(),
  
  winnerId: uuid("winner_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
})`;

schemaCode = schemaCode.replace(/export const badmintonSets = pgTable\("badminton_sets", \{[\s\S]*?\}\)/, newBadmintonSchema);

const newBadmintonRelations = `export const badmintonSetsRelations = relations(badmintonSets, ({ one }) => ({
  match: one(matches, { fields: [badmintonSets.matchId], references: [matches.id] }),
  player1: one(matchParticipants, { fields: [badmintonSets.player1Id], references: [matchParticipants.id], relationName: 'p1' }),
  team1Player2: one(matchParticipants, { fields: [badmintonSets.team1Player2Id], references: [matchParticipants.id], relationName: 't1p2' }),
  player2: one(matchParticipants, { fields: [badmintonSets.player2Id], references: [matchParticipants.id], relationName: 'p2' }),
  team2Player2: one(matchParticipants, { fields: [badmintonSets.team2Player2Id], references: [matchParticipants.id], relationName: 't2p2' }),
  winner: one(matchParticipants, { fields: [badmintonSets.winnerId], references: [matchParticipants.id], relationName: 'winner' }),
}))`;

schemaCode = schemaCode.replace(/export const badmintonSetsRelations = relations\(badmintonSets, \(\{ one \}\) => \(\{[\s\S]*?\}\)\)/, newBadmintonRelations);

fs.writeFileSync(schemaFile, schemaCode, 'utf8');

const matchesFile = path.join('E:', 'code', 'billu', 'lib', 'actions', 'matches.ts');
let matchesCode = fs.readFileSync(matchesFile, 'utf8');

matchesCode = matchesCode.replace(/team1Player1Id: mp1_1\.id,/, "player1Id: mp1_1.id,");
matchesCode = matchesCode.replace(/team2Player1Id: mp2_1\.id,/, "player2Id: mp2_1.id,");

fs.writeFileSync(matchesFile, matchesCode, 'utf8');
console.log('Fixed for drizzle push');
