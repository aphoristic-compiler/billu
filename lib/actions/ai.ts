'use server'

import { requireDbUser } from '@/lib/auth'
import { db, expenses, debts, events, matches, systemLeaks } from '@/lib/db'
import { desc, eq, or } from 'drizzle-orm'
import { queryMistral } from '@/lib/mistral'

export async function queryWingAI(userQuery: string) {
  const user = await requireDbUser()

  // 1. Fetch relevant DB Context for this user and general wing state
  
  // Pending debts for this user
  const userDebts = await db.query.debts.findMany({
    where: (d) => or(eq(d.fromUser, user.id), eq(d.toUser, user.id)),
    with: { debtor: true, creditor: true }
  });
  
  const pendingDebts = userDebts.filter(d => d.status === 'pending');
  const debtStrings = pendingDebts.map(d => {
    if (d.fromUser === user.id) return `You owe ${d.creditor.username} $${d.amount.toFixed(2)}`;
    return `${d.debtor.username} owes you $${d.amount.toFixed(2)}`;
  });

  // Recent expenses
  const recentExpenses = await db.query.expenses.findMany({
    orderBy: [desc(expenses.createdAt)],
    limit: 5,
    with: { payer: true }
  });
  const expenseStrings = recentExpenses.map(e => `${e.payer.username} paid $${e.totalAmount.toFixed(2)} for ${e.title}`);

  // Ongoing events
  const ongoingEvents = await db.query.events.findMany({
    where: eq(events.isArchived, false),
    orderBy: [desc(events.createdAt)],
    limit: 5
  });
  const eventStrings = ongoingEvents.map(e => `Event: ${e.title} at ${e.location} (Category: ${e.category})`);

  // Combine DB data
  const databaseData = `
DEBTS FOR CURRENT USER:
${debtStrings.length > 0 ? debtStrings.join('\n') : 'No pending debts.'}

RECENT EXPENSES:
${expenseStrings.length > 0 ? expenseStrings.join('\n') : 'No recent expenses.'}

ONGOING EVENTS:
${eventStrings.length > 0 ? eventStrings.join('\n') : 'No ongoing events.'}
  `.trim();

  // 2. Prepare Messages
  const systemPrompt = `You are the dedicated AI Assistant for our Match Tracking and Wing Expense Ledger. Your job is to answer user queries accurately by analyzing the provided database data. 

CRITICAL SECURITY & IDENTITY CONTEXT:
- The current user asking you this question is: ${user.username} (DisplayName: ${user.displayName})
- Any reference to "I", "me", "my", or "myself" in the user's query refers strictly to ${user.username}.

YOUR DATABASE RECORDS:
Below is the raw data from our custom tracking database:
---
${databaseData}
---

INSTRUCTIONS:
1. Identify the Persona: Focus only on information relevant to ${user.username} if they ask personal questions (e.g., debts, balances, stats).
2. Calculate Financials: If looking at a ledger or expense list, calculate exactly what ${user.username} owes to others, or what others owe to them. Format money clearly (e.g., $15.50).
3. Tone: Be conversational, brief, and friendly. We are a close wing of friends tracking match stats and group expenses.
4. Accuracy: If the database data does not contain the answer, do not make it up. Say: "I couldn't find any record of that in our database."

OUTPUT FORMAT:
Keep answers short and scannable. Use bullet points for lists of names or debts.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery }
  ];

  // 3. Call Mistral with rotation
  const response = await queryMistral(messages, user.id);
  
  return response;
}
