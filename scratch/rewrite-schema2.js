const fs = require('fs');
const path = require('path');

const schemaPath = path.join('E:', 'code', 'billu', 'lib', 'db', 'schema.ts');
let schemaLines = fs.readFileSync(schemaPath, 'utf8').split('\n');

const newTables = `// ─── Game Specific Tables ────────────────────────────────────────────────────────
export const cricketMatches = pgTable("cricket_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  format: varchar("format", { length: 50 }).notNull(),
  maxOvers: integer("max_overs").notNull(),
  team1Name: varchar("team_1_name", { length: 100 }),
  team2Name: varchar("team_2_name", { length: 100 }),
  tossWinner: varchar("toss_winner", { length: 100 }),
  battingFirst: varchar("batting_first", { length: 100 }),
})

export const cricketInnings = pgTable("cricket_innings", {
  id: uuid("id").primaryKey().defaultRandom(),
  cricketMatchId: uuid("cricket_match_id").notNull().references(() => cricketMatches.id, { onDelete: "cascade" }),
  inningNumber: integer("inning_number").notNull(),
  battingTeam: varchar("batting_team", { length: 100 }).notNull(),
  bowlingTeam: varchar("bowling_team", { length: 100 }).notNull(),
  totalRuns: integer("total_runs").notNull().default(0),
  totalWickets: integer("total_wickets").notNull().default(0),
  totalOvers: real("total_overs").notNull().default(0),
  isDeclared: boolean("is_declared").notNull().default(false),
  isCompleted: boolean("is_completed").notNull().default(false),
})

export const cricketBatterLogs = pgTable("cricket_batter_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  inningId: uuid("inning_id").notNull().references(() => cricketInnings.id, { onDelete: "cascade" }),
  matchParticipantId: uuid("match_participant_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  runs: integer("runs").notNull().default(0),
  balls: integer("balls").notNull().default(0),
  isOut: boolean("is_out").notNull().default(false),
})

export const cricketBowlerLogs = pgTable("cricket_bowler_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  inningId: uuid("inning_id").notNull().references(() => cricketInnings.id, { onDelete: "cascade" }),
  matchParticipantId: uuid("match_participant_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  overs: real("overs").notNull().default(0),
  runsConceded: integer("runs_conceded").notNull().default(0),
  wickets: integer("wickets").notNull().default(0),
})

export const badmintonSets = pgTable("badminton_sets", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  player1Id: uuid("player_1_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  score1: integer("score_1").notNull(),
  player2Id: uuid("player_2_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  score2: integer("score_2").notNull(),
  winnerId: uuid("winner_id").references(() => matchParticipants.id, { onDelete: "cascade" }),
})

export const cardRounds = pgTable("card_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
})

export const cardPlayerHands = pgTable("card_player_hands", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardRoundId: uuid("card_round_id").notNull().references(() => cardRounds.id, { onDelete: "cascade" }),
  matchParticipantId: uuid("match_participant_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  handsMade: integer("hands_made").notNull(),
})

export const pokerLedgers = pgTable("poker_ledgers", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  matchParticipantId: uuid("match_participant_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  chipsIn: integer("chips_in").notNull().default(0),
  chipsOut: integer("chips_out").notNull().default(0),
})`;

const newRelations = `export const cricketMatchesRelations = relations(cricketMatches, ({ one, many }) => ({
  match: one(matches, { fields: [cricketMatches.matchId], references: [matches.id] }),
  innings: many(cricketInnings),
}))
export const cricketInningsRelations = relations(cricketInnings, ({ one, many }) => ({
  cricketMatch: one(cricketMatches, { fields: [cricketInnings.cricketMatchId], references: [cricketMatches.id] }),
  batterLogs: many(cricketBatterLogs),
  bowlerLogs: many(cricketBowlerLogs),
}))
export const cricketBatterLogsRelations = relations(cricketBatterLogs, ({ one }) => ({
  inning: one(cricketInnings, { fields: [cricketBatterLogs.inningId], references: [cricketInnings.id] }),
  participant: one(matchParticipants, { fields: [cricketBatterLogs.matchParticipantId], references: [matchParticipants.id] }),
}))
export const cricketBowlerLogsRelations = relations(cricketBowlerLogs, ({ one }) => ({
  inning: one(cricketInnings, { fields: [cricketBowlerLogs.inningId], references: [cricketInnings.id] }),
  participant: one(matchParticipants, { fields: [cricketBowlerLogs.matchParticipantId], references: [matchParticipants.id] }),
}))

export const badmintonSetsRelations = relations(badmintonSets, ({ one }) => ({
  match: one(matches, { fields: [badmintonSets.matchId], references: [matches.id] }),
  player1: one(matchParticipants, { fields: [badmintonSets.player1Id], references: [matchParticipants.id], relationName: 'p1' }),
  player2: one(matchParticipants, { fields: [badmintonSets.player2Id], references: [matchParticipants.id], relationName: 'p2' }),
  winner: one(matchParticipants, { fields: [badmintonSets.winnerId], references: [matchParticipants.id], relationName: 'winner' }),
}))

export const cardRoundsRelations = relations(cardRounds, ({ one, many }) => ({
  match: one(matches, { fields: [cardRounds.matchId], references: [matches.id] }),
  hands: many(cardPlayerHands),
}))
export const cardPlayerHandsRelations = relations(cardPlayerHands, ({ one }) => ({
  round: one(cardRounds, { fields: [cardPlayerHands.cardRoundId], references: [cardRounds.id] }),
  participant: one(matchParticipants, { fields: [cardPlayerHands.matchParticipantId], references: [matchParticipants.id] }),
}))

export const pokerLedgersRelations = relations(pokerLedgers, ({ one }) => ({
  match: one(matches, { fields: [pokerLedgers.matchId], references: [matches.id] }),
  participant: one(matchParticipants, { fields: [pokerLedgers.matchParticipantId], references: [matchParticipants.id] }),
}))`;

// Find indices
let tableStart = schemaLines.findIndex(l => l.includes('export const matchRounds = pgTable('));
let tableEnd = schemaLines.findIndex((l, i) => i > tableStart && l === '})');
// Since matchRoundStats comes right after, find its end
let table2Start = schemaLines.findIndex(l => l.includes('export const matchRoundStats = pgTable('));
let table2End = schemaLines.findIndex((l, i) => i > table2Start && l === '})');

// Delete tables
schemaLines.splice(tableStart, (table2End - tableStart) + 1, newTables);

let rel1Start = schemaLines.findIndex(l => l.includes('export const matchRoundsRelations'));
let rel1End = schemaLines.findIndex((l, i) => i > rel1Start && l === '}))');
let rel2Start = schemaLines.findIndex(l => l.includes('export const matchRoundStatsRelations'));
let rel2End = schemaLines.findIndex((l, i) => i > rel2Start && l === '}))');

// Delete relations
schemaLines.splice(rel1Start, (rel2End - rel1Start) + 1, newRelations);

// Update match and matchParticipants relations
let content = schemaLines.join('\n');
content = content.replace('  rounds: many(matchRounds),', '  cricketMatches: many(cricketMatches),\n  badmintonSets: many(badmintonSets),\n  cardRounds: many(cardRounds),\n  pokerLedgers: many(pokerLedgers),');
content = content.replace('  roundStats: many(matchRoundStats),', '  cricketBatterLogs: many(cricketBatterLogs),\n  cricketBowlerLogs: many(cricketBowlerLogs),\n  badmintonSetWins: many(badmintonSets, { relationName: "winner" }),\n  cardPlayerHands: many(cardPlayerHands),\n  pokerLedgers: many(pokerLedgers),');

fs.writeFileSync(schemaPath, content, 'utf8');
console.log('Successfully rewritten schema.ts');
