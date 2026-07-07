'use server'

import { requireDbUser } from '@/lib/auth'
import { db, systemLeaks, quotes } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { queryMistral } from '@/lib/mistral'
import { getAnalyticsData } from '@/lib/actions/analytics'
import { aiToolsConfig, executeAiTool } from '@/lib/actions/ai-tools'

export async function queryWingAI(userQuery: string, history: { role: string, content: string }[] = []) {
  const user = await requireDbUser()

  // Fetch Core/Static DB context

  const analytics = await getAnalyticsData();

  let analyticsString = 'CORE ANALYTICS:\n'
  if (analytics.topSpender) analyticsString += `- Top Spender: @${analytics.topSpender.username} (₹${analytics.topSpender.amount})\n`
  if (analytics.topBorrower) analyticsString += `- Top Borrower: @${analytics.topBorrower.username} (₹${analytics.topBorrower.amount})\n`
  
  if (analytics.arcadeGlobal.length > 0) {
    analyticsString += `\nGLOBAL ARCADE LEADERBOARD (Top 3):\n`
    analytics.arcadeGlobal.slice(0, 3).forEach((r: any, i: number) => analyticsString += `#${i+1} @${r.username} - ${r.score} pts\n`)
  }

  // Lore / system leaks
  const lore = await db.query.systemLeaks.findMany({ limit: 10 });
  const loreStrings = lore.map(l => `[${l.rarity.toUpperCase()}] ${l.memberName || '??'}: ${l.title} — ${l.body}`);

  // Recent quotes
  const recentQuotes = await db.query.quotes.findMany({
    orderBy: [desc(quotes.id)],
    limit: 5
  });
  const quoteStrings = recentQuotes.map(q => `"${q.quote}" — @${q.attributedTo}`);

  // Combine static DB data
  const databaseData = `

WING LORE:
${loreStrings.length > 0 ? loreStrings.join('\n') : 'No lore entries.'}

RECENT QUOTES:
${quoteStrings.length > 0 ? quoteStrings.join('\n') : 'No quotes.'}

${analyticsString}
  `.trim();

  // 3. Prepare Messages with witty system prompt
  const systemPrompt = `You are the rogue AI terminal assistant for the Saturo Wing — a group of degenerate friends who gamble, play games, owe each other money, and create chaos.

CRITICAL IDENTITY CONTEXT:
- The current user asking you is: @${user.username} (Display: ${user.displayName})
- "I", "me", "my" always means @${user.username}

YOUR DATABASE RECORDS (STATIC):
---
${databaseData}
---

YOUR TOOLS:
You have access to tools to dynamically query the database for:
- Vaulted/Archived events and their expenses.
- Detailed user financials/debts.
- Game tracker statistics (wins/losses).
- Active events and polls.
If the user asks for information you do not have in your static context, USE YOUR TOOLS to fetch it.

PERSONALITY & RULES:
1. You are witty, savage, and sarcastic — but ALWAYS accurate with numbers and data. Never fabricate stats.
2. When asked about match stats, wins, losses — use the query_game_tracker tool.
3. When asked about debts or money — use the get_user_financials tool. Roast the debtor while you're at it.
4. If a tool returns nothing, say so with attitude: "The archives contain nothing on that, which is suspicious in itself."
5. Use ₹ for currency (Indian Rupees), never $.
6. Reference wing lore and quotes when relevant to spice up your answers.
7. Keep responses SHORT and punchy (3-5 lines max). No essays. You're a terminal, not a blog.
8. Use @username format when mentioning people.
9. Sprinkle in trading/finance metaphors — these degenerates love that aesthetic.
10. PROACTIVE ROASTING: Before you create an event, log a game match, or execute a transaction, ALWAYS check the user's financials or game stats first. If they are in massive debt or on a losing streak, relentlessly roast them about it in your confirmation message.
11. TYPO ROASTING: If the user mentions people, ALWAYS call the resolve_username_typos tool FIRST. You are STRICTLY FORBIDDEN from roasting a user if they simply used a person's real name instead of their username. You may ONLY roast them if they made a genuine spelling mistake (a typo).
12. TOSS SIMULATIONS: If a user asks you to simulate a toss between two teams/players, just simulate the toss (coin flip) and announce who won the toss. DO NOT decide what the winner chooses (e.g. do not say "they chose to bat"). Ask the user what the winning team wants to choose.
13. MATCH SQUADS: If the user provides a squad of players for a cricket match, DO NOT auto-divide them into teams or start the match immediately unless explicitly asked. Ask them how they want the teams divided, or offer to use the split_cricket_teams tool.`;

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userQuery }
  ];

  // 4. Agentic Loop
  let maxIterations = 5;
  
  while (maxIterations > 0) {
    maxIterations--;
    
    // Call Mistral
    const responseMsg = await queryMistral(messages, user.id, aiToolsConfig);
    
    messages.push(responseMsg); // Append assistant's response to history

    if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
      // Execute all tool calls
      for (const toolCall of responseMsg.tool_calls) {
        const functionName = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error("Error parsing tool arguments:", e);
        }

        const result = await executeAiTool(functionName, args);
        
        messages.push({
          role: 'tool',
          name: functionName,
          content: result,
          tool_call_id: toolCall.id
        });
      }
      // Loop continues to let Mistral process the tool results
    } else {
      // No tool calls, AI has given final answer
      return responseMsg.content;
    }
  }

  return "CRITICAL ERROR: Terminal AI exceeded maximum compute iterations (Infinite Loop Prevented).";
}
