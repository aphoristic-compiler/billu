'use server'

import { count, eq, and, sum } from 'drizzle-orm'
import {
  db,
  events,
  matches,
  matchParticipants,
  debts,
  vaultMedia,
  quotes,
} from '@/lib/db'
import { requireDbUser } from '@/lib/auth'

export async function getUserStats() {
  const user = await requireDbUser()

  const [
    [eventsCreated],
    played,
    [owed],
    [owing],
  ] = await Promise.all([
    db.select({ n: count() }).from(events).where(eq(events.createdBy, user.id)),
    db
      .select()
      .from(matchParticipants)
      .where(eq(matchParticipants.userId, user.id)),
    db
      .select({ total: sum(debts.amount) })
      .from(debts)
      .where(and(eq(debts.toUser, user.id), eq(debts.status, 'pending'))),
    db
      .select({ total: sum(debts.amount) })
      .from(debts)
      .where(and(eq(debts.fromUser, user.id), eq(debts.status, 'pending'))),
  ])

  const wins = played.filter((p) => p.isWinner).length
  const total = played.length
  const winRate = total ? Math.round((wins / total) * 100) : 0
  const netDebt = Number(owed.total ?? 0) - Number(owing.total ?? 0)

  return {
    username: user.username,
    displayName: user.displayName,
    eventsCreated: eventsCreated.n,
    matchesPlayed: total,
    wins,
    losses: total - wins,
    winRate,
    netDebt,
  }
}

export async function getDashboardStats() {
  const [[eventCount], [matchCount], [pendingDebt], [archiveCount], [quoteCount]] =
    await Promise.all([
      db.select({ n: count() }).from(events),
      db.select({ n: count() }).from(matches),
      db
        .select({ total: sum(debts.amount) })
        .from(debts)
        .where(eq(debts.status, 'pending')),
      db.select({ n: count() }).from(vaultMedia),
      db.select({ n: count() }).from(quotes),
    ])

  return {
    events: eventCount.n,
    matches: matchCount.n,
    pendingDebt: Number(pendingDebt.total ?? 0),
    archives: archiveCount.n + quoteCount.n,
  }
}
