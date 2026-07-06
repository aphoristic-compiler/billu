import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  real,
  integer,
  serial,
  jsonb,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── Enums ────────────────────────────────────────────────────────────────
export const eventCategoryEnum = pgEnum("event_category", [
  "treat",
  "dinner",
  "game",
  "outing",
  "trip",
  "meal",
  "event",
  "hangout",
])

export const eventLocationEnum = pgEnum("event_location", [
  "rehdi",
  "c_not",
  "fm",
  "301",
  "looters",
  "dominos",
  "outside_campus",
  "other",
])

export const rsvpStatusEnum = pgEnum("rsvp_status", ["long", "short", "hedge"])

export const debtStatusEnum = pgEnum("debt_status", ["pending", "settled"])

export const mediaTypeEnum = pgEnum("media_type", ["image", "video", "document"])

export const leakCategoryEnum = pgEnum("leak_category", [
  "member",
  "incident",
  "patch",
  "myth",
  "audit",
  "kernel",
  "misc",
])

export const leakRarityEnum = pgEnum("leak_rarity", [
  "common",
  "uncommon",
  "rare",
  "legendary",
])

// ─── 1. users ─────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: varchar("clerk_id", { length: 255 }).unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  bootSequenceSeen: boolean("boot_sequence_seen").notNull().default(false),
  soundEnabled: boolean("sound_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 2. events ────────────────────────────────────────────────────────────
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentEventId: uuid("parent_event_id"), // self-FK enforced via relations
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: eventCategoryEnum("category").notNull(),
  location: eventLocationEnum("location").notNull(),
  locationCustom: varchar("location_custom", { length: 255 }),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isLive: boolean("is_live").notNull().default(false),
  whatsappBlasted: boolean("whatsapp_blasted").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ─── 3. rsvps ─────────────────────────────────────────────────────────────
export const rsvps = pgTable(
  "rsvps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: rsvpStatusEnum("status").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("rsvps_event_user_unique").on(t.eventId, t.userId)],
)

// ─── 4. polls ─────────────────────────────────────────────────────────────
export const polls = pgTable("polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  isPinned: boolean("is_pinned").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 5. poll_options ──────────────────────────────────────────────────────
export const pollOptions = pgTable("poll_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
})

// ─── 6. poll_votes ────────────────────────────────────────────────────────
export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollOptionId: uuid("poll_option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("poll_votes_option_user_unique").on(t.pollOptionId, t.userId)],
)

// ─── 7. games ─────────────────────────────────────────────────────────────
export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 16 }).notNull(),
  minPlayers: integer("min_players").notNull().default(2),
  maxPlayers: integer("max_players").notNull().default(12),
  statSchema: jsonb("stat_schema").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 8. matches ───────────────────────────────────────────────────────────
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  eventId: uuid("event_id").references(() => events.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  playedAt: timestamp("played_at").notNull().defaultNow(),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).notNull().default("completed"),
  maxOvers: integer("max_overs"), // used for cricket
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 9. match_participants ────────────────────────────────────────────────
export const matchParticipants = pgTable("match_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  teamName: varchar("team_name", { length: 100 }),
  stats: jsonb("stats").notNull().default({}),
  isWinner: boolean("is_winner").notNull().default(false),
})

// ─── Game Specific Tables ────────────────────────────────────────────────────────
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
})
export const matchRounds = pgTable("match_rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // e.g., 'inning', 'set', 'round'
  status: varchar("status", { length: 20 }).notNull().default("ongoing"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const matchRoundStats = pgTable("match_round_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchRoundId: uuid("match_round_id").notNull().references(() => matchRounds.id, { onDelete: "cascade" }),
  matchParticipantId: uuid("match_participant_id").notNull().references(() => matchParticipants.id, { onDelete: "cascade" }),
  teamName: varchar("team_name", { length: 100 }),
  role: varchar("role", { length: 50 }), // e.g., 'batting', 'bowling'
  stats: jsonb("stats").notNull().default({}),
  isWinner: boolean("is_winner").default(false),
})

// ─── 10. expenses ─────────────────────────────────────────────────────────
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").references(() => events.id),
  paidBy: uuid("paid_by")
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  totalAmount: real("total_amount").notNull(),
  tag: varchar("tag", { length: 50 }),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurringCron: varchar("recurring_cron", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ─── 11. expense_splits ───────────────────────────────────────────────────
export const expenseSplits = pgTable("expense_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id")
    .notNull()
    .references(() => expenses.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  shareRatio: real("share_ratio"),
  description: text("description"),
})

// ─── 12. debts ────────────────────────────────────────────────────────────
export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromUser: uuid("from_user")
    .notNull()
    .references(() => users.id),
  toUser: uuid("to_user")
    .notNull()
    .references(() => users.id),
  amount: real("amount").notNull(),
  expenseId: uuid("expense_id").references(() => expenses.id),
  status: debtStatusEnum("status").notNull().default("pending"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 13. vault_media ──────────────────────────────────────────────────────
export const vaultMedia = pgTable("vault_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  eventId: uuid("event_id").references(() => events.id),
  cloudinaryUrl: text("cloudinary_url").notNull(),
  cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }).notNull(),
  mediaType: mediaTypeEnum("media_type").notNull().default("image"),
  caption: text("caption"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 13.5 daily_banners ───────────────────────────────────────────────────
export const dailyBanners = pgTable("daily_banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 14. quotes ───────────────────────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  addedBy: uuid("added_by")
    .notNull()
    .references(() => users.id),
  quote: text("quote").notNull(),
  attributedTo: varchar("attributed_to", { length: 255 }).notNull(),
  context: text("context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 15. active_arcade_game ───────────────────────────────────────────────
export const activeArcadeGame = pgTable("active_arcade_game", {
  id: uuid("id").primaryKey().defaultRandom(),
  prompt: text("prompt").notNull(),
  detailedPrompt: text("detailed_prompt"),
  generatedCode: text("generated_code"),
  status: varchar("status", { length: 20 }).notNull().default("generating"),
  generatedBy: uuid("generated_by")
    .notNull()
    .references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 16. arcade_leaderboard ───────────────────────────────────────────────
export const arcadeLeaderboard = pgTable("arcade_leaderboard", {
  id: uuid("id").primaryKey().defaultRandom(),
  arcadeGameId: uuid("arcade_game_id")
    .notNull()
    .references(() => activeArcadeGame.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  score: integer("score").notNull().default(0),
  timePlayed: real("time_played").notNull().default(0),
  attempts: integer("attempts").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 17. system_leaks ─────────────────────────────────────────────────────
export const systemLeaks = pgTable("system_leaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: leakCategoryEnum("category").notNull(),
  memberName: varchar("member_name", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  rarity: leakRarityEnum("rarity").notNull().default("common"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── 18. activity_log ─────────────────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// ─── Relations ────────────────────────────────────────────────────────────
export const eventsRelations = relations(events, ({ one, many }) => ({
  parent: one(events, {
    fields: [events.parentEventId],
    references: [events.id],
    relationName: "micro_events",
  }),
  microEvents: many(events, { relationName: "micro_events" }),
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
  rsvps: many(rsvps),
  polls: many(polls),
  expenses: many(expenses),
  vaultMedia: many(vaultMedia),
}))

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  event: one(events, { fields: [rsvps.eventId], references: [events.id] }),
  user: one(users, { fields: [rsvps.userId], references: [users.id] }),
}))

export const pollsRelations = relations(polls, ({ one, many }) => ({
  event: one(events, { fields: [polls.eventId], references: [events.id] }),
  creator: one(users, { fields: [polls.createdBy], references: [users.id] }),
  options: many(pollOptions),
}))

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(polls, { fields: [pollOptions.pollId], references: [polls.id] }),
  votes: many(pollVotes),
}))

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  option: one(pollOptions, {
    fields: [pollVotes.pollOptionId],
    references: [pollOptions.id],
  }),
  user: one(users, { fields: [pollVotes.userId], references: [users.id] }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => ({
  game: one(games, { fields: [matches.gameId], references: [games.id] }),
  participants: many(matchParticipants),
  cricketMatches: many(cricketMatches),
  badmintonSets: many(badmintonSets),
  cardRounds: many(cardRounds),
  pokerLedgers: many(pokerLedgers),
}))

export const matchParticipantsRelations = relations(matchParticipants, ({ one, many }) => ({
  match: one(matches, {
    fields: [matchParticipants.matchId],
    references: [matches.id],
  }),
  user: one(users, {
    fields: [matchParticipants.userId],
    references: [users.id],
  }),
  cricketBatterLogs: many(cricketBatterLogs),
  cricketBowlerLogs: many(cricketBowlerLogs),
  badmintonSetWins: many(badmintonSets, { relationName: "winner" }),
  cardPlayerHands: many(cardPlayerHands),
  pokerLedgers: many(pokerLedgers),
}))

export const cricketMatchesRelations = relations(cricketMatches, ({ one, many }) => ({
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
}))
export const matchRoundsRelations = relations(matchRounds, ({ one, many }) => ({
  match: one(matches, { fields: [matchRounds.matchId], references: [matches.id] }),
  stats: many(matchRoundStats),
}))

export const matchRoundStatsRelations = relations(matchRoundStats, ({ one }) => ({
  round: one(matchRounds, { fields: [matchRoundStats.matchRoundId], references: [matchRounds.id] }),
  participant: one(matchParticipants, { fields: [matchRoundStats.matchParticipantId], references: [matchParticipants.id] }),
}))

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  payer: one(users, { fields: [expenses.paidBy], references: [users.id] }),
  splits: many(expenseSplits),
  event: one(events, { fields: [expenses.eventId], references: [events.id] }),
}))

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
  user: one(users, { fields: [expenseSplits.userId], references: [users.id] }),
}))

export const debtsRelations = relations(debts, ({ one }) => ({
  debtor: one(users, { fields: [debts.fromUser], references: [users.id], relationName: "debtor" }),
  creditor: one(users, { fields: [debts.toUser], references: [users.id], relationName: "creditor" }),
}))

export const quotesRelations = relations(quotes, ({ one }) => ({
  author: one(users, { fields: [quotes.addedBy], references: [users.id] }),
}))

export const arcadeLeaderboardRelations = relations(arcadeLeaderboard, ({ one }) => ({
  game: one(activeArcadeGame, {
    fields: [arcadeLeaderboard.arcadeGameId],
    references: [activeArcadeGame.id],
  }),
  user: one(users, {
    fields: [arcadeLeaderboard.userId],
    references: [users.id],
  }),
}))

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}))

export const vaultMediaRelations = relations(vaultMedia, ({ one }) => ({
  uploader: one(users, {
    fields: [vaultMedia.uploadedBy],
    references: [users.id],
  }),
  event: one(events, {
    fields: [vaultMedia.eventId],
    references: [events.id],
  }),
}))

// ─── 22. push_subscriptions ────────────────────────────────────────────────
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}))
