'use server'

import { db, debts, expenses, matchParticipants, users } from '@/lib/db'
import { sql, eq, or } from 'drizzle-orm'
import { requireDbUser } from '@/lib/auth'

export async function getAnalyticsData() {
  await requireDbUser() // just require auth

  // 1. Top Spender & Top Borrower (From debts)
  // "Spender" = total money they paid for others (creditor in debts)
  // "Borrower" = total money they owe others (debtor in debts)
  const debtsRaw = await db.execute(sql`
    SELECT 
      from_user, to_user, amount, status 
    FROM debts 
    WHERE status = 'pending'
  `)

  const userOwes: Record<string, number> = {}
  const userOwed: Record<string, number> = {}

  debtsRaw.forEach((d: any) => {
    userOwes[d.from_user] = (userOwes[d.from_user] || 0) + Number(d.amount)
    userOwed[d.to_user] = (userOwed[d.to_user] || 0) + Number(d.amount)
  })

  let topSpenderId = Object.keys(userOwed).sort((a, b) => userOwed[b] - userOwed[a])[0]
  let topBorrowerId = Object.keys(userOwes).sort((a, b) => userOwes[b] - userOwes[a])[0]

  // 2. Socialite & Grinder (From events/rsvps)
  // Socialite = max RSVPs ('going') to events
  const rsvpCounts = await db.execute(sql`
    SELECT user_id, COUNT(*) as count 
    FROM rsvps 
    WHERE status = 'long'
    GROUP BY user_id
    ORDER BY count DESC
    LIMIT 1
  `)
  const socialiteId = rsvpCounts[0]?.user_id

  // Grinder = max RSVPs ('grinding' or 'not_going')
  const grindCounts = await db.execute(sql`
    SELECT user_id, COUNT(*) as count 
    FROM rsvps 
    WHERE status = 'short' OR status = 'hedge'
    GROUP BY user_id
    ORDER BY count DESC
    LIMIT 1
  `)
  const grinderId = grindCounts[0]?.user_id

  // Fetch user details for these IDs
  const allUserIds = Array.from(new Set([topSpenderId, topBorrowerId, socialiteId, grinderId].filter(Boolean)))
  
  let topSpender = null
  let topBorrower = null
  let socialite = null
  let grinder = null

  if (allUserIds.length > 0) {
    const ids = allUserIds.map(id => `'${id}'`).join(',')
    const usersData = await db.execute(sql`SELECT id, username FROM users WHERE id IN (${sql.raw(ids)})`)
    
    const userMap: Record<string, string> = {}
    usersData.forEach((u: any) => {
      userMap[u.id] = u.username
    })

    if (topSpenderId) topSpender = { username: userMap[topSpenderId], amount: userOwed[topSpenderId] }
    if (topBorrowerId) topBorrower = { username: userMap[topBorrowerId], amount: userOwes[topBorrowerId] }
    if (socialiteId) socialite = { username: userMap[socialiteId], count: rsvpCounts[0].count }
    if (grinderId) grinder = { username: userMap[grinderId], count: grindCounts[0].count }
  }

  // 3. Arcade Leaderboard (Global)
  const globalRaw = await db.execute(sql`
    WITH MaxScores AS (
      SELECT user_id, arcade_game_id, MAX(score) as max_score
      FROM arcade_leaderboard
      GROUP BY user_id, arcade_game_id
    )
    SELECT u.id as "userId", u.username, SUM(m.max_score) as "totalScore"
    FROM MaxScores m
    JOIN users u ON m.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY "totalScore" DESC
  `)

  const arcadeGlobal = globalRaw.map((r: any) => ({
    username: r.username,
    score: Number(r.totalScore),
  }))

  return {
    topSpender,
    topBorrower,
    socialite,
    grinder,
    arcadeGlobal,
  }
}
