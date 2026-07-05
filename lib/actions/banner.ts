'use server'

import { db, dailyBanners, activityLog, debts, matches, quotes, users, systemLeaks, events } from '@/lib/db'
import { eq, desc, sql } from 'drizzle-orm'
import { requireDbUser } from '@/lib/auth'
import { queryMistral } from '@/lib/mistral'

export async function getDailyBanner() {
  const user = await requireDbUser()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Ensure table exists (since drizzle-kit push is failing locally)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_banners (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date varchar(10) NOT NULL UNIQUE,
      content text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `)

  // 1. Check if we already have a banner for today
  const existing = await db.query.dailyBanners.findFirst({
    where: eq(dailyBanners.date, today),
  })

  if (existing) {
    return existing.content
  }

  // 2. We need to generate a new banner. Gather context.
  const [recentLogs, recentDebts, recentMatches, recentQuotes, memberLeaks, recentEvents, allUsers] = await Promise.all([
    db.query.activityLog.findMany({
      orderBy: [desc(activityLog.createdAt)],
      limit: 10,
    }),
    db.query.debts.findMany({
      orderBy: [desc(debts.createdAt)],
      limit: 5,
    }),
    db.query.matches.findMany({
      orderBy: [desc(matches.createdAt)],
      limit: 3,
      with: { game: true, participants: true },
    }),
    db.query.quotes.findMany({
      orderBy: [desc(quotes.id)],
      limit: 5,
    }),
    db.query.systemLeaks.findMany({
      where: eq(systemLeaks.category, 'member'),
      limit: 10,
    }),
    db.query.events.findMany({
      where: eq(events.isArchived, false),
      orderBy: [desc(events.createdAt)],
      limit: 3,
    }),
    db.query.users.findMany(),
  ])

  // Build context string
  let contextStr = 'RECENT WING ACTIVITY:\n\n'
  
  if (recentLogs.length > 0) {
    contextStr += 'LATEST ACTIONS:\n'
    recentLogs.forEach((log) => {
      const u = allUsers.find((u) => u.id === log.userId)
      contextStr += `- @${u?.username || 'someone'} did: ${log.actionType} - ${log.metadata}\n`
    })
    contextStr += '\n'
  }

  if (recentDebts.length > 0) {
    contextStr += 'RECENT DEBTS:\n'
    recentDebts.forEach((debt) => {
      const from = allUsers.find((u) => u.id === debt.fromUser)
      const to = allUsers.find((u) => u.id === debt.toUser)
      contextStr += `- @${from?.username} owes @${to?.username} ₹${debt.amount} (Status: ${debt.status})\n`
    })
    contextStr += '\n'
  }

  if (recentMatches.length > 0) {
    contextStr += 'RECENT GAMES:\n'
    recentMatches.forEach((match) => {
      contextStr += `- Played ${match.game?.name}. `
      match.participants.forEach((p) => {
        const u = allUsers.find((u) => u.id === p.userId)
        if (p.isWinner) contextStr += `@${u?.username} WON. `
        else contextStr += `@${u?.username} LOST. `
      })
      contextStr += '\n'
    })
    contextStr += '\n'
  }

  if (recentQuotes.length > 0) {
    contextStr += 'RECENT WING QUOTES:\n'
    recentQuotes.forEach((q) => {
      contextStr += `- "${q.quote}" — ${q.attributedTo} (${q.context || 'no context'})\n`
    })
    contextStr += '\n'
  }

  if (memberLeaks && memberLeaks.length > 0) {
    contextStr += 'MEMBER ANOMALIES (LORE):\n'
    memberLeaks.forEach((leak) => {
      contextStr += `- [${leak.rarity.toUpperCase()}] ${leak.memberName || 'Unknown'}: ${leak.title} - ${leak.body}\n`
    })
    contextStr += '\n'
  }

  if (recentEvents && recentEvents.length > 0) {
    contextStr += 'ONGOING / UPCOMING EVENTS:\n'
    recentEvents.forEach((ev) => {
      const u = allUsers.find((u) => u.id === ev.createdBy)
      contextStr += `- Event "${ev.title}" at ${ev.location} (Category: ${ev.category}), created by @${u?.username || 'someone'}\n`
    })
    contextStr += '\n'
  }

  // Check if we actually have any data
  const hasData = recentLogs.length > 0 || recentDebts.length > 0 || recentMatches.length > 0 || recentQuotes.length > 0 || (memberLeaks && memberLeaks.length > 0) || (recentEvents && recentEvents.length > 0)
  const memberNames = allUsers.map(u => `@${u.username}`).join(', ')

  // 3. Query Mistral
  const systemPrompt = `You are the chaotic, edgy AI announcer for the "Saturo Wing" (a group of degenerate friends who gamble, owe each other money, and play games).
Your job is to generate exactly 5-6 SHORT one-liners for the daily scrolling ticker on their dashboard.

FORMAT RULES (CRITICAL):
- Output EXACTLY 5-6 separate one-liner sentences, each on its own line.
- Each one-liner must be a STANDALONE roast, observation, or callout (max 15 words each).
- Do NOT write a paragraph. Do NOT connect sentences.
- Think of these like stock ticker headlines or news crawl items.

${hasData ? `KNOWN MEMBERS: ${memberNames}
Use the provided activity data to generate roasts. Only mention usernames that appear in the data below.` : `The database was just wiped clean. There is NO activity data, NO users, NO debts, NO games.
CRITICAL: Do NOT invent or fabricate any @usernames, debts, or game results.
Instead, generate generic funny one-liners about the wing being eerily quiet, the fresh start, the calm before the storm, etc.`}

ABSOLUTE RULE: NEVER make up usernames or stats that don't exist in the provided data. If the data is empty, keep it generic.
No hashtags. No markdown.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextStr }
  ]

  try {
    const aiResponse = await queryMistral(messages, user.id)
    const textContent = aiResponse.content || "The Wing AI had nothing to say."
    
    // Save to DB
    await db.insert(dailyBanners).values({
      date: today,
      content: textContent,
    })
    
    return textContent
  } catch (err) {
    console.error('Failed to generate daily banner:', err)
    return "The Wing AI is currently disconnected. Go touch some grass or log a debt."
  }
}
