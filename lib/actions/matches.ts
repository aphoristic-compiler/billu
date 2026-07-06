'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, inArray } from 'drizzle-orm'
import { db, games, matches, matchParticipants, users, matchRounds, matchRoundStats } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function logMatch(input: {
  gameId: string
  notes?: string
  eventId?: string
  status?: string
  maxOvers?: number
  participants: {
    userId: string
    teamName?: string
    stats: Record<string, number | string>
    isWinner: boolean
  }[]
}) {
  const user = await requireDbUser()

  const [match] = await db
    .insert(matches)
    .values({
      gameId: input.gameId,
      eventId: input.eventId || null,
      createdBy: user.id,
      notes: input.notes || null,
      status: input.status || 'completed',
      maxOvers: input.maxOvers || null,
    })
    .returning()

  if (input.participants.length > 0) {
    await db.insert(matchParticipants).values(
      input.participants.map((p) => ({
        matchId: match.id,
        userId: p.userId,
        teamName: p.teamName || null,
        stats: p.stats,
        isWinner: p.isWinner,
      })),
    )
  }

  const allGames = await db.select().from(games)
  const game = allGames.find((x: { id: string }) => x.id === input.gameId)
  
  if (input.status !== 'ongoing') {
    const allUsers = await db.select().from(users)
    const winners = input.participants
      .filter((p) => p.isWinner)
      .map(
        (p) =>
          '@' +
          (allUsers.find((u: { id: string }) => u.id === p.userId)?.username ?? '?'),
      )

    let pnlNote = ''
    if (game?.name === 'Poker') {
      const winnerPnl = input.participants
        .filter((p) => p.isWinner)
        .reduce(
          (sum, p) => sum + (Number(p.stats.chips_out) || 0) - (Number(p.stats.chips_in) || 0),
          0,
        )
      if (winnerPnl > 0) pnlNote = ` (+${winnerPnl.toLocaleString('en-IN')} chips)`
    }

    await logActivity(
      user.id,
      'match_logged',
      `[EXEC] $${(game?.name ?? 'GAME').toUpperCase()} match closed. Winner: ${winners.join(', ') || 'nobody'}${pnlNote}`,
    )
  } else {
    await logActivity(
      user.id,
      'match_started',
      `[EXEC] Started an ongoing $${(game?.name ?? 'GAME').toUpperCase()} match.`,
    )
  }

  revalidatePath('/hub')
  revalidatePath('/hub/games')
  return match
}

export async function addMatchRound(input: {
  matchId: string
  roundNumber: number
  type: string
  notes?: string
  participants: {
    userId: string
    teamName?: string
    role?: string
    stats: Record<string, any>
    isWinner?: boolean
  }[]
}) {
  const user = await requireDbUser()

  const [round] = await db
    .insert(matchRounds)
    .values({
      matchId: input.matchId,
      roundNumber: input.roundNumber,
      type: input.type,
      notes: input.notes || null,
      status: 'completed',
    })
    .returning()

  // Ensure participants exist in matchParticipants
  const currentParticipants = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, input.matchId))
  const newParticipantIds = input.participants.map(p => p.userId).filter(id => !currentParticipants.some(cp => cp.userId === id))
  
  if (newParticipantIds.length > 0) {
    await db.insert(matchParticipants).values(
      newParticipantIds.map(id => ({
        matchId: input.matchId,
        userId: id,
      }))
    )
  }

  const updatedParticipants = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, input.matchId))

  if (input.participants.length > 0) {
    await db.insert(matchRoundStats).values(
      input.participants.map(p => {
        const mp = updatedParticipants.find(up => up.userId === p.userId)
        return {
          matchRoundId: round.id,
          matchParticipantId: mp!.id,
          teamName: p.teamName || null,
          role: p.role || null,
          stats: p.stats,
          isWinner: p.isWinner || false,
        }
      })
    )
  }

  revalidatePath('/hub')
  revalidatePath('/hub/games')
  return round
}

export async function completeOngoingMatch(matchId: string, winners: string[] = []) {
  const user = await requireDbUser()
  
  await db.update(matches).set({ status: 'completed' }).where(eq(matches.id, matchId))
  
  const mps = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId))
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  const [game] = await db.select().from(games).where(eq(games.id, match.gameId))
  
  if (winners.length === 0) {
    // Auto calculate
    const rounds = await db.query.matchRounds.findMany({ where: eq(matchRounds.matchId, matchId), with: { stats: true } })
    const userScores: Record<string, number> = {}
    
    if (game.name === 'Cards') {
      rounds.forEach(r => r.stats.forEach(s => {
        userScores[s.matchParticipantId] = (userScores[s.matchParticipantId] || 0) + (Number(s.stats.hands_made) || 0)
      }))
    } else if (game.name === 'Badminton') {
      rounds.forEach(r => r.stats.forEach(s => {
        if (s.isWinner) userScores[s.matchParticipantId] = (userScores[s.matchParticipantId] || 0) + 1
      }))
    } else if (game.name === 'Cricket') {
      let r1 = 0, r2 = 0;
      let t1: string[] = [], t2: string[] = [];
      rounds.forEach(r => r.stats.forEach(s => {
        if (r.roundNumber === 1 && s.role === 'batting') { r1 += Number(s.stats.runs) || 0; t1.push(s.matchParticipantId) }
        if (r.roundNumber === 2 && s.role === 'batting') { r2 += Number(s.stats.runs) || 0; t2.push(s.matchParticipantId) }
      }))
      if (r1 > r2) t1.forEach(id => userScores[id] = 1)
      else if (r2 > r1) t2.forEach(id => userScores[id] = 1)
    }

    if (Object.keys(userScores).length > 0) {
      const maxScore = Math.max(...Object.values(userScores))
      const winnerMps = Object.entries(userScores).filter(([_, score]) => score === maxScore).map(([id]) => id)
      if (winnerMps.length > 0 && maxScore > 0) {
        await db.update(matchParticipants).set({ isWinner: true }).where(inArray(matchParticipants.id, winnerMps))
      }
    }
  } else if (winners.length > 0) {
    const winnerMps = mps.filter(mp => winners.includes(mp.userId))
    if (winnerMps.length > 0) {
      await db.update(matchParticipants).set({ isWinner: true }).where(inArray(matchParticipants.id, winnerMps.map(mp => mp.id)))
    }
  }

  await logActivity(
    user.id,
    'match_logged',
    `[EXEC] $${(game?.name ?? 'GAME').toUpperCase()} match was marked as completed.`,
  )

  revalidatePath('/hub')
  revalidatePath('/hub/games')
}

export async function getGamesData() {
  const defaultGames = [
    { name: 'Poker', icon: '🃏', minPlayers: 2, maxPlayers: 12, statSchema: { chips_in: 'number', chips_out: 'number' } },
    { name: 'Cards', icon: '🎴', minPlayers: 2, maxPlayers: 10, statSchema: { matchLevel: {}, roundLevel: { hands_made: 'number' } } },
    { name: 'Badminton', icon: '🏸', minPlayers: 2, maxPlayers: 4, statSchema: { matchLevel: {}, roundLevel: { score: 'number' } } },
    { name: 'Cricket', icon: '🏏', minPlayers: 2, maxPlayers: 22, statSchema: { matchLevel: {}, roundLevel: { batting: { runs: 'number', balls: 'number' }, bowling: { overs: 'number', wickets: 'number', runs_given: 'number' } } } },
  ]

  let allGames = await db.select().from(games)
  
  const poker = allGames.find((g: any) => g.name === 'Poker')
  if (poker && (poker.statSchema?.chips_won || poker.statSchema?.buy_in)) {
    await db.update(games)
      .set({ statSchema: { chips_in: 'number', chips_out: 'number' } })
      .where(eq(games.name, 'Poker'))
  }
  
  // Hard update schema for Cards, Badminton, Cricket
  for (const gameName of ['Cards', 'Badminton', 'Cricket']) {
    const existing = allGames.find((g: any) => g.name === gameName)
    const def = defaultGames.find(g => g.name === gameName)
    if (!existing) {
      await db.insert(games).values(def as any)
    } else {
      await db.update(games).set({ statSchema: def?.statSchema }).where(eq(games.id, existing.id))
    }
  }
  
  // Remove unused legacy games to clean up
  const keepGames = ['Poker', 'Cards', 'Badminton', 'Cricket']
  const deleteGames = allGames.filter(g => !keepGames.includes(g.name))
  for (const dg of deleteGames) {
    // Only delete if no matches use it
    const m = await db.select().from(matches).where(eq(matches.gameId, dg.id))
    if (m.length === 0) {
      await db.delete(games).where(eq(games.id, dg.id))
    }
  }

  allGames = await db.select().from(games).orderBy(games.name)

  const [allMatches, members] = await Promise.all([
    db.query.matches.findMany({
      orderBy: [desc(matches.playedAt)],
      with: { 
        game: true, 
        participants: { with: { user: true, roundStats: { with: { round: true } } } },
        rounds: { orderBy: [desc(matchRounds.roundNumber)] }
      },
    }),
    db.select().from(users).orderBy(users.username),
  ])
  return { games: allGames, matches: allMatches, members }
}
