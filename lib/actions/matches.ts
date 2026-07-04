'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { db, games, matches, matchParticipants, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function logMatch(input: {
  gameId: string
  notes?: string
  eventId?: string
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
    })
    .returning()

  await db.insert(matchParticipants).values(
    input.participants.map((p) => ({
      matchId: match.id,
      userId: p.userId,
      teamName: p.teamName || null,
      stats: p.stats,
      isWinner: p.isWinner,
    })),
  )

  const allGames = await db.select().from(games)
  const game = allGames.find((x: { id: string }) => x.id === input.gameId)
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

  revalidatePath('/hub')
  revalidatePath('/hub/games')
  return match
}

export async function getGamesData() {
  const defaultGames = [
    { name: 'Poker', icon: '🃏', minPlayers: 2, maxPlayers: 12, statSchema: { chips_in: 'number', chips_out: 'number' } },
    { name: 'FIFA', icon: '⚽', minPlayers: 2, maxPlayers: 4, statSchema: {} },
    { name: 'Catan', icon: '🐑', minPlayers: 3, maxPlayers: 6, statSchema: {} },
    { name: 'CS2', icon: '🔫', minPlayers: 2, maxPlayers: 10, statSchema: { kills: 'number', deaths: 'number' } },
    { name: 'Cricket', icon: '🏏', minPlayers: 2, maxPlayers: 22, statSchema: { runs: 'number', wickets: 'number' } },
    { name: 'Badminton', icon: '🏸', minPlayers: 2, maxPlayers: 4, statSchema: { sets_won: 'number', points_scored: 'number' } },
  ]

  let allGames = await db.select().from(games)
  
  const poker = allGames.find((g: any) => g.name === 'Poker')
  if (poker && (poker.statSchema?.chips_won || poker.statSchema?.buy_in)) {
    await db.update(games)
      .set({ statSchema: { chips_in: 'number', chips_out: 'number' } })
      .where(eq(games.name, 'Poker'))
  }

  const missingGames = defaultGames.filter((dg) => !allGames.some((g: any) => g.name === dg.name))
  if (missingGames.length > 0) {
    await db.insert(games).values(missingGames)
  }

  allGames = await db.select().from(games).orderBy(games.name)

  const [allMatches, members] = await Promise.all([
    db.query.matches.findMany({
      orderBy: [desc(matches.playedAt)],
      with: { game: true, participants: { with: { user: true } } },
    }),
    db.select().from(users).orderBy(users.username),
  ])
  return { games: allGames, matches: allMatches, members }
}
