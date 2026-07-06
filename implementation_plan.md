# Intricate Game Tracking Architecture

## Goal
Implement a highly detailed game tracking system tailored for Poker, Cards, Badminton, and Cricket. This system must support rounds, innings, sets, dynamic team changes per round, and specific roles (e.g., batting vs bowling). The AI tools must also be upgraded to log round-by-round statistics for ongoing matches and analyze these deep stats for predictions.

## Schema Changes

1. **`matches` table**:
   - Add `status` field (`'ongoing' | 'completed'`). Defaults to `'completed'` for backward compatibility, but allows live-tracking for intricate games.

2. **New Table: `match_rounds`**:
   - `id`: UUID
   - `matchId`: references `matches`
   - `roundNumber`: integer (1, 2, 3...)
   - `type`: varchar (e.g., 'inning', 'set', 'round')
   - `createdAt`: timestamp

3. **New Table: `match_round_stats`**:
   - `id`: UUID
   - `matchRoundId`: references `match_rounds`
   - `matchParticipantId`: references `match_participants`
   - `teamName`: varchar (allows teams to change per round, e.g., Cards, Badminton)
   - `role`: varchar (e.g., 'batting', 'bowling')
   - `stats`: jsonb (e.g., `{ runs, balls, wickets }` or `{ score }`)
   - `isWinner`: boolean (e.g., won this specific set/round)

4. **Update `games` table schemas**:
   Update the `statSchema` to support nested definitions for `matchLevel` and `roundLevel` stats.
   - Poker: Match level (chips in/out)
   - Cards: Round level (hands made), Match level (overall points/winner)
   - Badminton: Round level (set score), Match level (overall winner)
   - Cricket: Round level with roles (batting: runs, balls; bowling: overs, wickets, runs).

## UI Changes (`components/games/game-tracker.tsx`)

1. **Match Creation Wizard**:
   - Refactor the simple "Add Match" dialog into a multi-step or game-specific wizard.
   - For Poker: Ask for chips in/out.
   - For Cricket: Ask to start an 'ongoing' match, then provide an interface to add Innings, select batting/bowling teams, and log runs/wickets.
   - For Cards/Badminton: Allow adding rounds/sets sequentially, with the ability to change teams for each round.
2. **Match Rendering**:
   - The match history view must visually represent rounds (e.g., an accordion for a Cricket match showing Inning 1 and Inning 2 scorecards).

## AI Tools Updates (`lib/actions/ai-tools.ts` & `lib/actions/ai.ts`)

1. **Ongoing Match Tools**:
   - `start_ongoing_match`: Creates a match with status 'ongoing'.
   - `log_round_stats`: Logs stats for a specific round/set/inning for users in an ongoing match.
   - `complete_match`: Marks an ongoing match as completed and calculates overall winners.
2. **Specialized Logging Tools**:
   - `log_cricket_stats`: Specifically handles batting/bowling roles and creates innings.
   - `log_badminton_set`: Logs a set's scores and assigns set winners.
3. **Analytics & Predictions (`simulate_match_odds`)**:
   - Upgrade the prediction tool to dig into `match_round_stats` (e.g., calculating a player's average cricket batting strike rate, or average badminton points per set) to provide deeply analytical odds.

## Open Questions

> [!WARNING] 
> User feedback required on the following points:
> 1. **Live vs Post-Match:** For Cricket, do you want to log ball-by-ball live via the AI, or just summarize the inning's final stats (e.g. "Aryan scored 50 runs, Tushar took 2 wickets")?
> 2. **Cards Scoring:** You mentioned "no points system, but you may implement it by using hands as a metric". Should the app strictly use hands to determine the overall winner, or just display the hands and let you manually toggle who won the overall match?
> 3. **AI Intrusiveness:** If the AI notices an ongoing match, should it proactively ask for updates when you chat with it, or strictly wait for your commands?
