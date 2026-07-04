'use server'

import { db, activityLog, debts, expenses, users } from '@/lib/db'
import { eq, or, desc } from 'drizzle-orm'
import { requireDbUser } from '@/lib/auth'

export async function getDashboardData() {
  const user = await requireDbUser()

  // Fetch recent activity
  const recentActivityRaw = await db
    .select()
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(10)

  const recentActivity = recentActivityRaw.map((row) => ({
    ...row.activity_log,
    user: row.users,
  }))

  // Calculate user's net balance
  const userDebts = await db.query.debts.findMany({
    where: (d) => or(eq(d.fromUser, user.id), eq(d.toUser, user.id)),
  })

  let netBalance = 0
  let totalOwedToUser = 0
  let totalUserOwes = 0

  userDebts.forEach(d => {
    if (d.status === 'pending') {
      if (d.fromUser === user.id) {
        netBalance -= d.amount
        totalUserOwes += d.amount
      } else {
        netBalance += d.amount
        totalOwedToUser += d.amount
      }
    }
  })

  return {
    recentActivity,
    netBalance,
    totalOwedToUser,
    totalUserOwes,
    user
  }
}
