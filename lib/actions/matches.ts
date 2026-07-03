'use server'

import { revalidatePath } from 'next/cache'
import { desc } from 'drizzle-orm'
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
        (sum, p) => sum + (Number(p.stats.cash_out) || 0) - (Number(p.stats.buy_in) || 0),
        0,
      )
    if (winnerPnl > 0) pnlNote = ` (+₹${winnerPnl.toLocaleString('en-IN')})`
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
  const [allGames, allMatches, members] = await Promise.all([
    db.select().from(games).orderBy(games.name),
    db.query.matches.findMany({
      orderBy: [desc(matches.playedAt)],
      with: { game: true, participants: { with: { user: true } } },
    }),
    db.select().from(users).orderBy(users.username),
  ])
  return { games: allGames, matches: allMatches, members }
}
