'use server'

import { requireDbUser } from '@/lib/auth'
import { db, expenses, debts, events, matches, matchParticipants, users, systemLeaks, quotes } from '@/lib/db'
import { desc, eq, or } from 'drizzle-orm'
import { queryMistral } from '@/lib/mistral'

export async function queryWingAI(userQuery: string) {
  const user = await requireDbUser()

  // 1. Fetch ALL relevant DB context

  // Pending debts for this user
  const userDebts = await db.query.debts.findMany({
    where: (d) => or(eq(d.fromUser, user.id), eq(d.toUser, user.id)),
    with: { debtor: true, creditor: true }
  });
  
  const pendingDebts = userDebts.filter(d => d.status === 'pending');
  const debtStrings = pendingDebts.map(d => {
    if (d.fromUser === user.id) return `You owe @${d.creditor.username} ₹${d.amount.toFixed(2)}`;
    return `@${d.debtor.username} owes you ₹${d.amount.toFixed(2)}`;
  });

  // Recent expenses
  const recentExpenses = await db.query.expenses.findMany({
    orderBy: [desc(expenses.createdAt)],
    limit: 10,
    with: { payer: true }
  });
  const expenseStrings = recentExpenses.map(e => `@${e.payer.username} paid ₹${e.totalAmount.toFixed(2)} for "${e.title}" on ${new Date(e.createdAt).toLocaleDateString()}`);

  // Ongoing events
  const ongoingEvents = await db.query.events.findMany({
    where: eq(events.isArchived, false),
    orderBy: [desc(events.createdAt)],
    limit: 5
  });
  const eventStrings = ongoingEvents.map(e => `Event: "${e.title}" at ${e.location} (Category: ${e.category})`);

  // MATCH & GAME DATA — this is what was missing
  const allParticipations = await db.query.matchParticipants.findMany({
    where: eq(matchParticipants.userId, user.id),
    with: { match: { with: { game: true, participants: { with: { user: true } } } } }
  });

  const userWins = allParticipations.filter(p => p.isWinner).length;
  const userLosses = allParticipations.filter(p => !p.isWinner).length;
  const userTotal = allParticipations.length;
  const winRate = userTotal > 0 ? Math.round((userWins / userTotal) * 100) : 0;

  // Build per-game breakdown
  const gameBreakdown: Record<string, { wins: number; losses: number; total: number }> = {};
  for (const p of allParticipations) {
    const gameName = p.match?.game?.name || 'Unknown';
    if (!gameBreakdown[gameName]) gameBreakdown[gameName] = { wins: 0, losses: 0, total: 0 };
    gameBreakdown[gameName].total++;
    if (p.isWinner) gameBreakdown[gameName].wins++;
    else gameBreakdown[gameName].losses++;
  }

  const gameStrings = Object.entries(gameBreakdown).map(([game, stats]) =>
    `${game}: ${stats.total} matches played (${stats.wins}W / ${stats.losses}L, ${stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0}% win rate)`
  );

  // Recent matches with opponents
  const recentMatchStrings = allParticipations.slice(0, 5).map(p => {
    const opponents = p.match?.participants?.filter(op => op.userId !== user.id).map(op => `@${op.user?.username || '??'}`).join(', ') || 'solo';
    const result = p.isWinner ? 'WON ✓' : 'LOST ✗';
    return `${p.match?.game?.name || '??'} vs ${opponents}: ${result}`;
  });

  // All wing members
  const allUsers = await db.query.users.findMany();
  const memberList = allUsers.map(u => `@${u.username}`).join(', ');

  // Lore / system leaks
  const lore = await db.query.systemLeaks.findMany({ limit: 10 });
  const loreStrings = lore.map(l => `[${l.rarity.toUpperCase()}] ${l.memberName || '??'}: ${l.title} — ${l.body}`);

  // Recent quotes
  const recentQuotes = await db.query.quotes.findMany({
    orderBy: [desc(quotes.id)],
    limit: 5
  });
  const quoteStrings = recentQuotes.map(q => `"${q.quote}" — @${q.attributedTo}`);

  // 2. Combine all DB data
  const databaseData = `
CURRENT USER MATCH STATS:
- Total matches: ${userTotal}
- Wins: ${userWins} | Losses: ${userLosses} | Win Rate: ${winRate}%

PER-GAME BREAKDOWN:
${gameStrings.length > 0 ? gameStrings.join('\n') : 'No games played yet.'}

RECENT MATCH RESULTS:
${recentMatchStrings.length > 0 ? recentMatchStrings.join('\n') : 'No recent matches.'}

DEBTS FOR CURRENT USER:
${debtStrings.length > 0 ? debtStrings.join('\n') : 'No pending debts.'}

RECENT EXPENSES:
${expenseStrings.length > 0 ? expenseStrings.join('\n') : 'No recent expenses.'}

ONGOING EVENTS:
${eventStrings.length > 0 ? eventStrings.join('\n') : 'No ongoing events.'}

WING MEMBERS:
${memberList}

WING LORE:
${loreStrings.length > 0 ? loreStrings.join('\n') : 'No lore entries.'}

RECENT QUOTES:
${quoteStrings.length > 0 ? quoteStrings.join('\n') : 'No quotes.'}
  `.trim();

  // 3. Prepare Messages with witty system prompt
  const systemPrompt = `You are the rogue AI terminal assistant for the Saturo Wing — a group of degenerate friends who gamble, play games, owe each other money, and create chaos.

CRITICAL IDENTITY CONTEXT:
- The current user asking you is: @${user.username} (Display: ${user.displayName})
- "I", "me", "my" always means @${user.username}

YOUR DATABASE RECORDS:
---
${databaseData}
---

PERSONALITY & RULES:
1. You are witty, savage, and sarcastic — but ALWAYS accurate with numbers and data. Never fabricate stats.
2. When asked about match stats, wins, losses — pull EXACT numbers from the database above. Calculate correctly.
3. When asked about debts or money — give precise amounts. Roast the debtor while you're at it.
4. If you don't have data for something, say so with attitude: "The archives contain nothing on that, which is suspicious in itself."
5. Use ₹ for currency (Indian Rupees), never $.
6. Reference wing lore and quotes when relevant to spice up your answers.
7. Keep responses SHORT and punchy (3-5 lines max). No essays. You're a terminal, not a blog.
8. Use @username format when mentioning people.
9. Sprinkle in trading/finance metaphors — these degenerates love that aesthetic.
10. If someone asks "who am I" or identity questions, give them their full stat card with attitude.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ];

  // 4. Call Mistral
  const response = await queryMistral(messages, user.id);
  
  return response;
}
