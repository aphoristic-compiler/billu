'use server'

import { db, activityLog, debts, expenses, users, events, polls, pollOptions } from '@/lib/db'
import { eq, or, desc, sql, isNull } from 'drizzle-orm'
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

  // Ensure is_pinned column exists
  try {
    await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;`)
  } catch (e) {
    // Ignore if it fails due to dialect differences, though Postgres handles this fine
  }

  // Fetch pinned events (fully hydrated)
  const pinnedTopLevel = await db.query.events.findMany({
    where: (e) => eq(e.isPinned, true),
    orderBy: [desc(events.createdAt)],
    limit: 3,
    with: {
      creator: true,
      rsvps: { with: { user: true } },
      expenses: { with: { payer: true, splits: { with: { user: true } } } },
      polls: {
        with: {
          options: { with: { votes: { with: { user: true } } } },
        },
      },
    },
  })

  // Safely map to avoid Drizzle circular references
  const pinnedEvents = pinnedTopLevel.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    location: e.location,
    locationCustom: e.locationCustom,
    startsAt: e.startsAt ? e.startsAt.toISOString() : null,
    isLive: e.isLive,
    isPinned: e.isPinned,
    whatsappBlasted: e.whatsappBlasted,
    createdBy: e.createdBy,
    creator: e.creator ? { id: e.creator.id, username: e.creator.username, displayName: e.creator.displayName } : null,
    rsvps: (e.rsvps || []).map((r) => ({
      id: r.id,
      status: r.status,
      userId: r.userId,
      user: r.user ? { id: r.user.id, username: r.user.username, displayName: r.user.displayName } : null
    })),
    microEvents: [], // Don't need microevents for the dashboard widget
    polls: (e.polls || []).map((p) => ({
      id: p.id,
      question: p.question,
      options: (p.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        votes: (o.votes || []).map((v) => ({
          id: v.id,
          userId: v.userId,
          user: v.user ? { id: v.user.id, username: v.user.username, displayName: v.user.displayName } : null
        }))
      }))
    })),
    expenses: e.expenses || [],
  }))

  // Fetch pinned standalone polls
  const pinnedPollsTopLevel = await db.query.polls.findMany({
    where: (p) => eq(p.isPinned, true),
    orderBy: [desc(polls.createdAt)],
    limit: 3,
    with: {
      creator: true,
      options: {
        orderBy: [pollOptions.sortOrder],
        with: { votes: { with: { user: true } } },
      },
    },
  })
  
  const pinnedPolls = pinnedPollsTopLevel.map((p) => ({
    id: p.id,
    question: p.question,
    isPinned: p.isPinned,
    creator: p.creator ? { username: p.creator.username } : null,
    options: p.options.map(o => ({
      id: o.id,
      label: o.label,
      votes: o.votes.map(v => ({ userId: v.userId }))
    }))
  }))

  return {
    recentActivity,
    netBalance,
    totalOwedToUser,
    totalUserOwes,
    user,
    pinnedEvents,
    pinnedPolls,
  }
}
