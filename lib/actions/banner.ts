'use server'

import { db, dailyBanners, activityLog, debts, matches, quotes, users, systemLeaks } from '@/lib/db'
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
  const [recentLogs, recentDebts, recentMatches, recentQuotes, memberLeaks, allUsers] = await Promise.all([
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

  // 3. Query Mistral
  const systemPrompt = `You are the chaotic, edgy, and highly opinionated AI announcer for the "Saturo Wing" (a group of degenerate friends who gamble, owe each other money, and play games).
Your job is to generate exactly 5-6 SHORT one-liners for the daily scrolling ticker on their dashboard.

FORMAT RULES (CRITICAL):
- Output EXACTLY 5-6 separate one-liner sentences, each on its own line.
- Each one-liner must be a STANDALONE roast, observation, or callout (max 15 words each).
- Do NOT write a paragraph. Do NOT connect sentences with "and" or "meanwhile".
- Think of these like stock ticker headlines or news crawl items.
- Each line should hit different — one about debts, one about games, one about lore, etc.

EXAMPLE FORMAT:
@anshul's wallet is on life support. Someone call an ambulance.
@hitesh lost 3 poker games straight. The house always wins, king.
@tushar still measuring doorframes. Growth is a mindset, not a metric.
Wing debt pool crossed ₹2000. We're basically a micro-lending startup now.
@shreyansh typed "gg" after losing. No it wasn't.

Use the provided recent activity, debts, games, and lore to generate these.
Mention specific usernames (with @). Be savage but funny. No hashtags. No markdown.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextStr }
  ]

  try {
    const aiResponse = await queryMistral(messages, user.id)
    
    // Save to DB
    await db.insert(dailyBanners).values({
      date: today,
      content: aiResponse,
    })
    
    return aiResponse
  } catch (err) {
    console.error('Failed to generate daily banner:', err)
    return "The Wing AI is currently disconnected. Go touch some grass or log a debt."
  }
}
