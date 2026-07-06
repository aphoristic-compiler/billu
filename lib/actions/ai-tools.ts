import { db, events, expenses, debts, users, matchParticipants, matches, games, polls, pollOptions, pollVotes, systemLeaks, rsvps } from '@/lib/db'
import { eq, or, ilike, and, desc, sql } from 'drizzle-orm'
import { createEvent, updateEvent, addMicroEvent, deleteEvent, archiveEvent, toggleEventPin } from '@/lib/actions/events'
import { logMatch } from '@/lib/actions/matches'
import { addExpense } from '@/lib/actions/expenses'
import { createStandalonePoll, deletePoll, archivePoll, togglePollPin } from '@/lib/actions/polls'
import { requireDbUser } from '@/lib/auth'
import { logSystemLeak } from '@/lib/activity'
import { getAnalyticsData } from '@/lib/actions/analytics'

export const aiToolsConfig = [
  {
    type: 'function',
    function: {
      name: 'search_vault',
      description: 'Search for archived (vaulted) events by title, description, or location.',
      parameters: {
        type: 'object',
        properties: { searchQuery: { type: 'string', description: 'The search term (e.g. "goa", "dinner")' } },
        required: ['searchQuery']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_vault_trip_expenses',
      description: 'Get all expenses and who paid for a specific event/trip using its event ID.',
      parameters: {
        type: 'object',
        properties: { eventId: { type: 'string', description: 'The UUID of the event' } },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_user_financials',
      description: 'Get detailed pending debts for a specific user to see exactly who they owe and who owes them.',
      parameters: {
        type: 'object',
        properties: { username: { type: 'string', description: 'The username or real name of the person' } },
        required: ['username']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_game_tracker',
      description: 'Get match statistics (wins, losses) for the whole wing across different games.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_active_events',
      description: 'Fetch all ongoing, non-archived events currently active in the wing.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_polls',
      description: 'Fetch all active polls/surveys and their current vote counts.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compile_roast_dossier',
      description: 'Compiles a massive dossier on a user including debts, recent events they created or skipped, and their targeted lore/anomalies for roasting.',
      parameters: {
        type: 'object',
        properties: { username: { type: 'string' } },
        required: ['username']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_systemic_risk',
      description: 'Analyzes all pending debts in the wing to find the central node of debt (who holds the most risk).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'simulate_match_odds',
      description: 'Calculates the historical mathematical odds of winning between two players in a specific game.',
      parameters: {
        type: 'object',
        properties: {
          player1: { type: 'string' },
          player2: { type: 'string' },
          gameName: { type: 'string', description: 'Name of the game (e.g. FIFA, Poker)' }
        },
        required: ['player1', 'player2', 'gameName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'dig_up_dirt',
      description: 'Queries a users worst traits: events they created that failed, times they skipped events to grind, and worst game performances.',
      parameters: {
        type: 'object',
        properties: { username: { type: 'string' } },
        required: ['username']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_market_sentiment',
      description: 'Analyzes recent polls and RSVP velocity to output if the wing is Bullish (social) or Bearish (grinding).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: 'Creates a new event (e.g. dinner, trip, outing).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: ['treat', 'dinner', 'game', 'outing', 'trip', 'other'] },
          location: { type: 'string', enum: ['rehdi', 'c_not', 'fm', '301', 'looters', 'dominos', 'outside_campus', 'other'] },
          locationCustom: { type: 'string', description: 'Used only if location is other' },
          startsAt: { type: 'string', description: 'ISO string of the time' },
          whatsappBlasted: { type: 'boolean', description: 'Whether to notify everyone' },
          microEvents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                location: { type: 'string' },
                locationCustom: { type: 'string' }
              },
              required: ['title', 'location']
            }
          }
        },
        required: ['title', 'category', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_event',
      description: 'Edits an existing event title or time.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string' },
          title: { type: 'string' },
          startsAt: { type: 'string' }
        },
        required: ['eventId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: 'Deletes an event or microevent by name.',
      parameters: {
        type: 'object',
        properties: {
          eventName: { type: 'string', description: 'Name of the event or microevent to delete' }
        },
        required: ['eventName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'vault_event',
      description: 'Vaults (archives) an event by name.',
      parameters: {
        type: 'object',
        properties: {
          eventName: { type: 'string', description: 'Name of the event to vault' }
        },
        required: ['eventName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pin_event',
      description: 'Pins or unpins an event to the watchlist by name.',
      parameters: {
        type: 'object',
        properties: {
          eventName: { type: 'string', description: 'Name of the event to pin/unpin' }
        },
        required: ['eventName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_poll',
      description: 'Deletes a poll (market survey) by matching its question.',
      parameters: {
        type: 'object',
        properties: {
          pollQuestion: { type: 'string', description: 'A snippet of the poll question to delete' }
        },
        required: ['pollQuestion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'vault_poll',
      description: 'Vaults (archives) a poll (market survey) by matching its question.',
      parameters: {
        type: 'object',
        properties: {
          pollQuestion: { type: 'string', description: 'A snippet of the poll question to vault' }
        },
        required: ['pollQuestion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'pin_poll',
      description: 'Pins or unpins a poll to the watchlist by matching its question.',
      parameters: {
        type: 'object',
        properties: {
          pollQuestion: { type: 'string', description: 'A snippet of the poll question to pin/unpin' }
        },
        required: ['pollQuestion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_full_leaderboard',
      description: 'Gets the complete Arcade Global Leaderboard rankings for all members.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_wing_members',
      description: 'Lists all registered members of the wing (usernames and display names).',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_market_surveys',
      description: 'Lists all active market surveys (polls) and their options/vote counts.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_poll_details',
      description: 'Get detailed options and voters for a specific market survey.',
      parameters: {
        type: 'object',
        properties: {
          pollQuestion: { type: 'string', description: 'A snippet of the poll question' }
        },
        required: ['pollQuestion']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'blast_event',
      description: 'Blast a specific event or microevent (sub-position) to the wing.',
      parameters: {
        type: 'object',
        properties: {
          eventName: { type: 'string', description: 'Name of the event or microevent to blast' }
        },
        required: ['eventName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_microevent',
      description: 'Adds a microevent (e.g. dinner, specific location) to an existing parent event/trip.',
      parameters: {
        type: 'object',
        properties: {
          parentEventName: { type: 'string', description: 'Name of the parent event/trip' },
          title: { type: 'string' },
          location: { type: 'string', enum: ['rehdi', 'c_not', 'fm', '301', 'looters', 'dominos', 'outside_campus', 'other'] },
          locationCustom: { type: 'string', description: 'Used only if location is other' },
          startsAt: { type: 'string', description: 'ISO string of the time' }
        },
        required: ['parentEventName', 'title', 'location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_game_match',
      description: 'Logs a match result for a game. For poker, pass chips_in and chips_out in stats.',
      parameters: {
        type: 'object',
        properties: {
          gameName: { type: 'string' },
          notes: { type: 'string' },
          participants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                isWinner: { type: 'boolean' },
                chips_in: { type: 'number' },
                chips_out: { type: 'number' }
              },
              required: ['username', 'isWinner']
            }
          }
        },
        required: ['gameName', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_transaction',
      description: 'Logs a standalone financial transaction/expense with multiple splits.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          totalAmount: { type: 'number' },
          payerUsername: { type: 'string' },
          eventName: { type: 'string', description: 'Optional: Title of the event or microevent this transaction belongs to (e.g. dinner, poker game)' },
          splits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                amount: { type: 'number' }
              },
              required: ['username', 'amount']
            },
            description: 'List of users involved and exactly how much they OWE towards the total. (e.g., if total is 1000 split equally between payer and another user, the other user owes 500. The payer can also be in the splits if they owe a share, but usually splits define what OTHERS owe. Make sure to include ALL splits that make up the total.)'
          }
        },
        required: ['title', 'totalAmount', 'payerUsername', 'splits']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_market_survey',
      description: 'Creates a standalone poll/survey for the wing to vote on.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } }
        },
        required: ['question', 'options']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_poll',
      description: 'Edits an existing poll (either standalone or attached to an event) by changing the question and completely resetting the options.',
      parameters: {
        type: 'object',
        properties: {
          pollQuestion: { type: 'string', description: 'Search term for the poll question to edit.' },
          newQuestion: { type: 'string' },
          newOptions: { type: 'array', items: { type: 'string' } }
        },
        required: ['pollQuestion', 'newQuestion', 'newOptions']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_expense',
      description: 'Edits an existing expense.',
      parameters: {
        type: 'object',
        properties: {
          expenseId: { type: 'string' },
          title: { type: 'string' },
          totalAmount: { type: 'number' },
          paidBy: { type: 'string', description: 'The username of the person who paid this expense.' },
          splits: {
            type: 'array',
            description: 'Array of { username, amount } for the updated splits.',
            items: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                amount: { type: 'number' }
              }
            }
          }
        },
        required: ['expenseId', 'title', 'totalAmount', 'paidBy', 'splits']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'blast_asset',
      description: 'Blasts (sends a push notification to everyone in the wing) about an event or market survey poll. Used to hype up the wing.',
      parameters: {
        type: 'object',
        properties: {
          assetName: { type: 'string', description: 'The title/name of the event or poll to blast.' },
          assetType: { type: 'string', enum: ['event', 'poll'] },
          hypeMessage: { type: 'string', description: 'A savage, hype-inducing notification body.' }
        },
        required: ['assetName', 'assetType', 'hypeMessage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_cricket_stats',
      description: 'Log a cricket over, runs, and wickets incrementally for an ongoing match. You MUST state the remaining overs and runs to win if the second inning is happening.',
      parameters: {
        type: 'object',
        properties: {
          battingPlayer: { type: 'string', description: 'Username or display name of the batter.' },
          bowlingPlayer: { type: 'string', description: 'Username or display name of the bowler.' },
          runsScored: { type: 'number', description: 'Runs scored in this over/instance.' },
          wicketsFallen: { type: 'number', description: 'Wickets taken.' },
          ballsFaced: { type: 'number', description: 'Number of balls faced by the batter.' },
          inningNumber: { type: 'number', description: '1 or 2.' }
        },
        required: ['battingPlayer', 'bowlingPlayer', 'runsScored', 'wicketsFallen', 'inningNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_cards_round',
      description: 'Log a finished round of cards.',
      parameters: {
        type: 'object',
        properties: {
          roundNumber: { type: 'number' },
          participants: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                playerName: { type: 'string', description: 'Username or display name of the player.' },
                handsMade: { type: 'number', description: 'Number of hands made.' }
              },
              required: ['playerName', 'handsMade']
            }
          }
        },
        required: ['roundNumber', 'participants']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_badminton_set',
      description: 'Log a finished badminton set (supports doubles/singles).',
      parameters: {
        type: 'object',
        properties: {
          setNumber: { type: 'number' },
          team1Player1: { type: 'string', description: 'Username or display name of first player on team 1.' },
          team1Player2: { type: 'string', description: 'Username or display name of second player on team 1 (optional).' },
          team1Score: { type: 'number' },
          team2Player1: { type: 'string', description: 'Username or display name of first player on team 2.' },
          team2Player2: { type: 'string', description: 'Username or display name of second player on team 2 (optional).' },
          team2Score: { type: 'number' }
        },
        required: ['setNumber', 'team1Player1', 'team1Score', 'team2Player1', 'team2Score']
      }
    }
  }
];

export async function executeAiTool(name: string, args: any) {
  try {
    switch (name) {
      case 'search_vault': return await search_vault(args.searchQuery);
      case 'get_vault_trip_expenses': return await get_vault_trip_expenses(args.eventId);
      case 'get_user_financials': return await get_user_financials(args.username);
      case 'query_game_tracker': return await query_game_tracker();
      case 'query_active_events': return await query_active_events();
      case 'query_polls': return await query_polls();
      case 'compile_roast_dossier': return await compile_roast_dossier(args.username);
      case 'calculate_systemic_risk': return await calculate_systemic_risk();
      case 'simulate_match_odds': return await simulate_match_odds(args.player1, args.player2, args.gameName);
      case 'dig_up_dirt': return await dig_up_dirt(args.username);
      case 'query_market_sentiment': return await query_market_sentiment();
      
      // Write Tools
      case 'create_event': return await ai_create_event(args);
      case 'edit_event': return await ai_edit_event(args);
      case 'delete_event': return await ai_delete_event(args);
      case 'vault_event': return await ai_vault_event(args);
      case 'pin_event': return await ai_pin_event(args);
      case 'add_microevent': return await ai_add_microevent(args);
      
        case 'log_cricket_stats': return await ai_log_cricket_stats(args);
        case 'log_cards_round': return await ai_log_cards_round(args);
        case 'log_badminton_set': return await ai_log_badminton_set(args);

        case 'add_game_match': return await ai_add_game_match(args);
      case 'execute_transaction': return await ai_execute_transaction(args);
      case 'edit_expense': return await ai_edit_expense(args);
      case 'create_market_survey': return await ai_create_market_survey(args);
      case 'delete_poll': return await ai_delete_poll(args);
      case 'vault_poll': return await ai_vault_poll(args);
      case 'pin_poll': return await ai_pin_poll(args);
      case 'edit_poll': return await ai_edit_poll(args);
      case 'blast_asset': return await ai_blast_event(args);
      case 'get_full_leaderboard': return await ai_get_full_leaderboard();
      case 'list_wing_members': return await ai_list_wing_members();
      case 'list_market_surveys': return await ai_list_market_surveys(args);
      case 'get_poll_details': return await ai_get_poll_details(args);
      case 'blast_event': return await ai_blast_event(args);
      case 'log_system_leak': return await ai_log_system_leak(args);
      
      default: return JSON.stringify({ error: `Tool ${name} not found.` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `System Error executing ${name}: ${err.message}` });
  }
}

// --------------------------------------------------------------------------------
// EXISTING TOOLS
// --------------------------------------------------------------------------------

async function search_vault(query: string) {
  const q = `%${query}%`;
  const results = await db.query.events.findMany({
    where: and(eq(events.isArchived, true), or(ilike(events.title, q), ilike(events.description, q), ilike(events.location, q))),
    limit: 5,
    with: { creator: true }
  });
  if (results.length === 0) return JSON.stringify({ message: "No vaulted events found matching query." });
  return JSON.stringify(results.map((e: any) => ({
    id: e.id, title: e.title, category: e.category, location: e.location, date: e.startsAt, creator: e.creator?.username
  })));
}

async function get_vault_trip_expenses(eventId: string) {
  const tripExpenses = await db.query.expenses.findMany({ where: eq(expenses.eventId, eventId), with: { payer: true } });
  if (tripExpenses.length === 0) return JSON.stringify({ message: "No expenses logged for this event." });
  return JSON.stringify(tripExpenses.map((e: any) => ({
    title: e.title, amount: e.totalAmount, payer: e.payer?.username, date: e.createdAt
  })));
}

async function get_user_financials(username: string) {
  const targetUser = await db.query.users.findFirst({ where: or(eq(users.username, username.replace('@', '')), ilike(users.displayName, `%${username.replace('@', '')}%`)) });
  if (!targetUser) return JSON.stringify({ error: "User not found." });
  const pendingDebts = await db.query.debts.findMany({
    where: and(or(eq(debts.fromUser, targetUser.id), eq(debts.toUser, targetUser.id)), eq(debts.status, 'pending')),
    with: { debtor: true, creditor: true }
  });
  if (pendingDebts.length === 0) return JSON.stringify({ message: `@${username} has no pending debts. Pure profit.` });
  return JSON.stringify(pendingDebts.map((d: any) => {
    if (d.fromUser === targetUser.id) return `Owes @${d.creditor?.username} ₹${d.amount}`;
    return `Is owed ₹${d.amount} by @${d.debtor?.username}`;
  }));
}

async function query_game_tracker() {
  const allParticipations = await db.query.matchParticipants.findMany({ with: { match: { with: { game: true } }, user: true } });
  const stats: Record<string, Record<string, { wins: number, losses: number }>> = {};
  allParticipations.forEach((p: any) => {
    const gameName = p.match?.game?.name || 'Unknown';
    const username = p.user?.username;
    if (!username) return;
    if (!stats[gameName]) stats[gameName] = {};
    if (!stats[gameName][username]) stats[gameName][username] = { wins: 0, losses: 0 };
    if (p.isWinner) stats[gameName][username].wins++;
    else stats[gameName][username].losses++;
  });
  return JSON.stringify(stats);
}

async function query_active_events() {
  const activeEvents = await db.query.events.findMany({ where: eq(events.isArchived, false), orderBy: [desc(events.createdAt)], with: { creator: true } });
  if (activeEvents.length === 0) return JSON.stringify({ message: "No active events right now." });
  return JSON.stringify(activeEvents.map((e: any) => ({ title: e.title, category: e.category, location: e.location, creator: e.creator?.username })));
}

async function query_polls() {
  const activePolls = await db.query.polls.findMany({ with: { creator: true, options: { with: { votes: { with: { user: true } } } } } });
  if (activePolls.length === 0) return JSON.stringify({ message: "No active market surveys." });
  return JSON.stringify(activePolls.map((p: any) => ({
    question: p.question, creator: p.creator?.username, isPinned: p.isPinned, isAnonymous: p.isAnonymous,
    options: p.options.map((o: any) => ({ 
      label: o.label, 
      votes: o.votes.length, 
      voters: p.isAnonymous ? ['REDACTED (anonymous)'] : o.votes.map((v: any) => v.user?.username) 
    }))
  })));
}

// --------------------------------------------------------------------------------
// NEW DEGENERATE TOOLS
// --------------------------------------------------------------------------------

async function compile_roast_dossier(username: string) {
  const targetUser = await db.query.users.findFirst({ where: or(eq(users.username, username.replace('@', '')), ilike(users.displayName, `%${username.replace('@', '')}%`)) });
  if (!targetUser) return JSON.stringify({ error: "User not found." });

  const financials = await get_user_financials(username);
  
  const targetLore = await db.query.systemLeaks.findMany({
    where: ilike(systemLeaks.memberName, `%${username}%`)
  });

  const recentEvents = await db.query.events.findMany({
    where: eq(events.createdBy, targetUser.id),
    orderBy: [desc(events.createdAt)],
    limit: 3
  });

  return JSON.stringify({
    target: username,
    financials: JSON.parse(financials),
    lore_anomalies: targetLore.map((l: any) => l.body),
    recent_events_organized: recentEvents.map((e: any) => e.title)
  });
}

async function calculate_systemic_risk() {
  const allDebts = await db.execute(sql`SELECT from_user, to_user, amount FROM debts WHERE status = 'pending'`);
  let totalMarketLiquidity = 0;
  const exposureByDebtor: Record<string, number> = {};

  allDebts.forEach((d: any) => {
    const amt = Number(d.amount);
    totalMarketLiquidity += amt;
    exposureByDebtor[d.from_user] = (exposureByDebtor[d.from_user] || 0) + amt;
  });

  if (totalMarketLiquidity === 0) return JSON.stringify({ message: "No systemic risk. Market is illiquid (no pending debts)." });

  let highestRiskUser = null;
  let highestExposure = 0;
  for (const [userId, exp] of Object.entries(exposureByDebtor)) {
    if (exp > highestExposure) {
      highestExposure = exp;
      highestRiskUser = userId;
    }
  }

  if (highestRiskUser) {
    const userRes = await db.execute(sql`SELECT username FROM users WHERE id = ${highestRiskUser}`);
    const username = (userRes[0] as any)?.username || 'Unknown';
    const riskPercentage = ((highestExposure / totalMarketLiquidity) * 100).toFixed(2);
    
    return JSON.stringify({
      total_market_debt: totalMarketLiquidity,
      systemic_risk_node: username,
      risk_percentage: `${riskPercentage}%`,
      verdict: `If @${username} defaults on their ₹${highestExposure} debt, ${riskPercentage}% of the Wing's active liquidity is wiped out.`
    });
  }

  return JSON.stringify({ message: "Risk distributed evenly." });
}

async function simulate_match_odds(player1: string, player2: string, gameName: string) {
  const p1 = await db.query.users.findFirst({ where: or(eq(users.username, player1.replace('@', '')), ilike(users.displayName, `%${player1.replace('@', '')}%`)) });
  const p2 = await db.query.users.findFirst({ where: or(eq(users.username, player2.replace('@', '')), ilike(users.displayName, `%${player2.replace('@', '')}%`)) });
  
  if (!p1 || !p2) return JSON.stringify({ error: "One or both players not found." });

  // fetch stats
  const allParticipations = await db.query.matchParticipants.findMany({
    with: { match: { with: { game: true } } }
  });

  let p1Wins = 0, p1Total = 0;
  let p2Wins = 0, p2Total = 0;

  allParticipations.forEach((p: any) => {
    if (p.match?.game?.name?.toLowerCase() === gameName.toLowerCase()) {
      if (p.userId === p1.id) {
        p1Total++;
        if (p.isWinner) p1Wins++;
      }
      if (p.userId === p2.id) {
        p2Total++;
        if (p.isWinner) p2Wins++;
      }
    }
  });

  const p1Rate = p1Total > 0 ? p1Wins / p1Total : 0;
  const p2Rate = p2Total > 0 ? p2Wins / p2Total : 0;
  
  if (p1Total === 0 && p2Total === 0) return JSON.stringify({ message: `No historical data for ${gameName} between these players.` });

  const totalRate = p1Rate + p2Rate;
  let p1Odds = 50, p2Odds = 50;
  
  if (totalRate > 0) {
    p1Odds = (p1Rate / totalRate) * 100;
    p2Odds = (p2Rate / totalRate) * 100;
  }

  return JSON.stringify({
    game: gameName,
    player1: { name: player1, win_rate: `${(p1Rate*100).toFixed(1)}%`, predicted_odds: `${p1Odds.toFixed(1)}%` },
    player2: { name: player2, win_rate: `${(p2Rate*100).toFixed(1)}%`, predicted_odds: `${p2Odds.toFixed(1)}%` },
    verdict: p1Odds > p2Odds ? `@${player1} is favored.` : p2Odds > p1Odds ? `@${player2} is favored.` : "Too close to call (50/50)."
  });
}

async function dig_up_dirt(username: string) {
  const targetUser = await db.query.users.findFirst({ where: or(eq(users.username, username.replace('@', '')), ilike(users.displayName, `%${username.replace('@', '')}%`)) });
  if (!targetUser) return JSON.stringify({ error: "User not found." });

  // 1. Grinding stats (skipping)
  const grindingRsvps = await db.query.rsvps.findMany({
    where: and(eq(rsvps.userId, targetUser.id), or(eq(rsvps.status, 'short'), eq(rsvps.status, 'hedge'))),
    with: { event: true }
  });

  // 2. Archived/Dead events they created
  const deadEvents = await db.query.events.findMany({
    where: and(eq(events.createdBy, targetUser.id), eq(events.isArchived, true))
  });

  return JSON.stringify({
    target: username,
    times_skipped_to_grind: grindingRsvps.length,
    notable_events_skipped: grindingRsvps.slice(0, 3).map((r: any) => r.event?.title),
    dead_events_created: deadEvents.map((e: any) => e.title)
  });
}

async function query_market_sentiment() {
  const activeEvents = await db.execute(sql`SELECT count(*) FROM events WHERE is_archived = false`);
  const activePolls = await db.execute(sql`SELECT count(*) FROM polls`);
  const recentRsvps = await db.execute(sql`
    SELECT status, count(*) as count 
    FROM rsvps 
    GROUP BY status
  `);

  let goingCount = 0;
  let grindingCount = 0;
  
  recentRsvps.forEach((r: any) => {
    if (r.status === 'long') goingCount += Number(r.count);
    if (r.status === 'short' || r.status === 'hedge') grindingCount += Number(r.count);
  });

  const total = goingCount + grindingCount;
  let sentiment = "NEUTRAL";
  if (total > 0) {
    const bullishRatio = goingCount / total;
    if (bullishRatio > 0.6) sentiment = "BULLISH (Highly Social / Spending)";
    else if (bullishRatio < 0.4) sentiment = "BEARISH (Grinding / Saving / Dead)";
  }

  return JSON.stringify({
    market_sentiment: sentiment,
    active_events: Number((activeEvents[0] as any)?.count || 0),
    active_polls: Number((activePolls[0] as any)?.count || 0),
    social_ratio: `${goingCount} GOING vs ${grindingCount} GRINDING`
  });
}

// --------------------------------------------------------------------------------
// GOD MODE (WRITE) TOOLS
// --------------------------------------------------------------------------------

async function ai_create_event(args: any) {
  try {
    const ev = await createEvent({
      title: args.title,
      category: args.category || 'other',
      location: args.location || 'other',
      locationCustom: args.locationCustom,
      startsAt: args.startsAt,
      whatsappBlasted: args.whatsappBlasted,
      microEvents: args.microEvents
    });
    return JSON.stringify({ success: true, eventId: ev.id, message: "Event created successfully." });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_edit_event(args: any) {
  try {
    const existingEvent = await db.query.events.findFirst({
      where: eq(events.id, args.eventId)
    });
    
    if (!existingEvent) return JSON.stringify({ error: "Event not found." });

    await updateEvent(args.eventId, {
      title: args.title || existingEvent.title,
      category: existingEvent.category as any,
      location: existingEvent.location as any,
      locationCustom: existingEvent.locationCustom || undefined,
      startsAt: args.startsAt || existingEvent.startsAt?.toISOString()
    });
    return JSON.stringify({ success: true, message: "Event updated successfully." });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_delete_event(args: any) {
  try {
    const existingEvent = await db.query.events.findFirst({
      where: ilike(events.title, `%${args.eventName}%`),
      orderBy: [desc(events.createdAt)]
    });
    
    if (!existingEvent) return JSON.stringify({ error: `Event matching '${args.eventName}' not found.` });

    await deleteEvent(existingEvent.id);
    return JSON.stringify({ success: true, message: `Event '${existingEvent.title}' deleted successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_vault_event(args: any) {
  try {
    const existingEvent = await db.query.events.findFirst({
      where: ilike(events.title, `%${args.eventName}%`),
      orderBy: [desc(events.createdAt)]
    });
    
    if (!existingEvent) return JSON.stringify({ error: `Event matching '${args.eventName}' not found.` });

    await archiveEvent(existingEvent.id);
    return JSON.stringify({ success: true, message: `Event '${existingEvent.title}' vaulted successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_pin_event(args: any) {
  try {
    const existingEvent = await db.query.events.findFirst({
      where: ilike(events.title, `%${args.eventName}%`),
      orderBy: [desc(events.createdAt)]
    });
    
    if (!existingEvent) return JSON.stringify({ error: `Event matching '${args.eventName}' not found.` });

    await toggleEventPin(existingEvent.id);
    const action = !existingEvent.isPinned ? "pinned" : "unpinned";
    return JSON.stringify({ success: true, message: `Event '${existingEvent.title}' ${action} successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_add_microevent(args: any) {
  try {
    const parentEvent = await db.query.events.findFirst({
      where: ilike(events.title, `%${args.parentEventName}%`),
      orderBy: [desc(events.createdAt)]
    });
    
    if (!parentEvent) return JSON.stringify({ error: `Parent event matching '${args.parentEventName}' not found.` });

    await addMicroEvent(parentEvent.id, {
      title: args.title,
      location: args.location || 'other',
      locationCustom: args.locationCustom,
      startsAt: args.startsAt
    });

    return JSON.stringify({ success: true, message: "Microevent added successfully to " + parentEvent.title });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}


import { getGamesData, completeOngoingMatch, logCricketOver, logCricketBatter, logBadmintonSet, logCardsRound, logPokerLedger } from '@/lib/actions/matches'

async function ai_log_cricket_stats(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true, cricketMatches: { with: { innings: true } } } });
    const cricketMatch = ongoingMatches.find(m => m.game?.name === 'Cricket');
    if (!cricketMatch) return JSON.stringify({ error: 'No ongoing cricket match found.' });

    const batter = await db.query.users.findFirst({ where: or(eq(users.username, args.battingPlayer.replace('@', '')), ilike(users.displayName, `%${args.battingPlayer.replace('@', '')}%`)) });
    const bowler = await db.query.users.findFirst({ where: or(eq(users.username, args.bowlingPlayer.replace('@', '')), ilike(users.displayName, `%${args.bowlingPlayer.replace('@', '')}%`)) });

    if (!batter) return JSON.stringify({ error: `Batter ${args.battingPlayer} not found.` });
    if (!bowler) return JSON.stringify({ error: `Bowler ${args.bowlingPlayer} not found.` });

    await logCricketBatter(cricketMatch.id, args.inningNumber, batter.id, args.runsScored, args.ballsFaced || 0, false);
    await logCricketOver(cricketMatch.id, args.inningNumber, bowler.id, args.runsScored, args.wicketsFallen);

    return JSON.stringify({ message: `Logged ${args.runsScored} runs for ${batter.displayName}, and ${args.wicketsFallen} wickets for ${bowler.displayName}.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_log_cards_round(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const cardsMatch = ongoingMatches.find(m => m.game?.name === 'Cards');
    if (!cardsMatch) return JSON.stringify({ error: 'No ongoing cards match found.' });

    const participantsData = [];
    for (const p of args.participants) {
      const user = await db.query.users.findFirst({ where: or(eq(users.username, p.playerName.replace('@', '')), ilike(users.displayName, `%${p.playerName.replace('@', '')}%`)) });
      if (user) {
        participantsData.push({ userId: user.id, handsMade: p.handsMade });
      }
    }

    if (participantsData.length === 0) return JSON.stringify({ error: "No valid participants found." });

    await logCardsRound(cardsMatch.id, args.roundNumber, participantsData);

    return JSON.stringify({ message: `Logged card round ${args.roundNumber} successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_log_badminton_set(args: any) {
  try {
    const ongoingMatches = await db.query.matches.findMany({ where: eq(matches.status, 'ongoing'), with: { game: true } });
    const badmintonMatch = ongoingMatches.find(m => m.game?.name === 'Badminton');
    if (!badmintonMatch) return JSON.stringify({ error: 'No ongoing badminton match found.' });

    const resolveUser = async (username: string) => {
      if (!username) return null;
      return await db.query.users.findFirst({ where: or(eq(users.username, username.replace('@', '')), ilike(users.displayName, `%${username.replace('@', '')}%`)) });
    }

    const t1p1 = await resolveUser(args.team1Player1);
    const t1p2 = await resolveUser(args.team1Player2);
    const t2p1 = await resolveUser(args.team2Player1);
    const t2p2 = await resolveUser(args.team2Player2);

    if (!t1p1 || !t2p1) return JSON.stringify({ error: "At least one player per team is required." });

    const team1 = [t1p1.id];
    if (t1p2) team1.push(t1p2.id);
    const team2 = [t2p1.id];
    if (t2p2) team2.push(t2p2.id);

    await logBadmintonSet(badmintonMatch.id, args.setNumber, team1, args.team1Score, team2, args.team2Score);

    return JSON.stringify({ message: `Logged badminton set ${args.setNumber} successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_add_game_match(args: any) {
  try {
    const gameRecord = await db.query.games.findFirst({
      where: ilike(games.name, args.gameName)
    });
    if (!gameRecord) return JSON.stringify({ error: `Game ${args.gameName} not found in DB.` });

    const participantsData = [];
    for (const p of args.participants) {
      const u = await db.query.users.findFirst({ where: or(eq(users.username, p.username.replace('@', '')), ilike(users.displayName, `%${p.username.replace('@', '')}%`)) });
      if (u) {
        participantsData.push({
          userId: u.id,
          isWinner: p.isWinner,
          stats: { chips_in: p.chips_in, chips_out: p.chips_out }
        });
      }
    }

    if (participantsData.length === 0) return JSON.stringify({ error: "No valid participants found." });

    await logMatch({
      gameId: gameRecord.id,
      notes: args.notes,
      participants: participantsData
    });

    return JSON.stringify({ success: true, message: "Match logged successfully." });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_execute_transaction(args: any) {
  try {
    const payer = await db.query.users.findFirst({ where: or(eq(users.username, args.payerUsername.replace('@', '')), ilike(users.displayName, `%${args.payerUsername.replace('@', '')}%`)) });
    if (!payer) return JSON.stringify({ error: "Payer not found." });

    let eventId = null;
    if (args.eventName) {
      const existingEvent = await db.query.events.findFirst({
        where: ilike(events.title, `%${args.eventName}%`),
        orderBy: [desc(events.createdAt)]
      });
      if (existingEvent) {
        eventId = existingEvent.id;
      }
    }

    const allUsers = await db.query.users.findMany();
    const mappedSplits = [];
    for (const split of args.splits) {
      const u = allUsers.find(u => u.username.toLowerCase() === split.username.toLowerCase());
      if (!u) return JSON.stringify({ error: `User ${split.username} not found for splits.` });
      mappedSplits.push({ userId: u.id, amount: split.amount });
    }

    await addExpense({
      title: args.title,
      totalAmount: args.totalAmount,
      paidBy: payer.id,
      eventId: eventId,
      splits: mappedSplits
    });

    const attachMsg = eventId ? ` attached to event.` : ``;
    return JSON.stringify({ success: true, message: `Transaction logged: ${args.title} for ₹${args.totalAmount}${attachMsg}` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_create_market_survey(args: any) {
  try {
    await createStandalonePoll(args.question, args.options);
    return JSON.stringify({ success: true, message: "Market survey logged." });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_delete_poll(args: any) {
  try {
    const poll = await db.query.polls.findFirst({
      where: ilike(polls.question, `%${args.pollQuestion}%`),
      orderBy: [desc(polls.createdAt)]
    });
    if (!poll) return JSON.stringify({ error: "Poll not found." });

    await deletePoll(poll.id);
    return JSON.stringify({ success: true, message: `Poll '${poll.question}' deleted.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_vault_poll(args: any) {
  try {
    const poll = await db.query.polls.findFirst({
      where: ilike(polls.question, `%${args.pollQuestion}%`),
      orderBy: [desc(polls.createdAt)]
    });
    if (!poll) return JSON.stringify({ error: "Poll not found." });

    await archivePoll(poll.id);
    return JSON.stringify({ success: true, message: `Poll '${poll.question}' vaulted.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_pin_poll(args: any) {
  try {
    const poll = await db.query.polls.findFirst({
      where: ilike(polls.question, `%${args.pollQuestion}%`),
      orderBy: [desc(polls.createdAt)]
    });
    if (!poll) return JSON.stringify({ error: "Poll not found." });

    await togglePollPin(poll.id);
    const action = !poll.isPinned ? "pinned" : "unpinned";
    return JSON.stringify({ success: true, message: `Poll '${poll.question}' ${action}.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_edit_poll(args: any) {
  try {
    const poll = await db.query.polls.findFirst({
      where: ilike(polls.question, `%${args.pollQuestion}%`),
      orderBy: [desc(polls.createdAt)]
    });
    if (!poll) return JSON.stringify({ error: "Poll not found." });

    const { editPoll } = await import('@/lib/actions/polls');
    await editPoll(poll.id, args.newQuestion, args.newOptions);
    return JSON.stringify({ success: true, message: `Poll '${args.pollQuestion}' edited successfully.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_list_market_surveys(args: any) {
  try {
    const activePolls = await db.query.polls.findMany({
      where: eq(polls.isArchived, false),
      orderBy: [desc(polls.createdAt)],
      with: {
        options: {
          with: { votes: true }
        }
      }
    });

    const result = activePolls.map((p: any) => ({
      question: p.question,
      options: p.options.map((o: any) => ({
        label: o.label,
        votes: o.votes.length
      }))
    }));

    return JSON.stringify({ active_polls: result });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_log_system_leak(args: any) {
  try {
    await logSystemLeak({
      memberName: args.memberName,
      body: args.body
    });
    return JSON.stringify({ success: true, message: `Leak logged for ${args.memberName}.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_get_full_leaderboard() {
  try {
    const analytics = await getAnalyticsData();
    const result = analytics.arcadeGlobal.map((r: any, i: number) => `#${i+1} @${r.username} - ${r.score} pts`);
    return JSON.stringify({ leaderboard: result });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_list_wing_members() {
  try {
    const allMembers = await db.query.users.findMany();
    const result = allMembers.map((m: any) => `@${m.username} (${m.displayName})`);
    return JSON.stringify({ members: result });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

import { updateExpense } from '@/lib/actions/expenses'

async function ai_edit_expense(args: any) {
  try {
    const { expenseId, title, totalAmount, paidBy, splits } = args;
    
    const payerUser = await db.query.users.findFirst({ where: or(eq(users.username, paidBy.replace('@', '')), ilike(users.displayName, `%${paidBy.replace('@', '')}%`)) });
    if (!payerUser) return JSON.stringify({ error: `Payer user @${paidBy} not found.` });

    // map usernames to user IDs for the splits
    const finalSplits = [];
    for (const s of splits) {
      const u = await db.query.users.findFirst({ where: or(eq(users.username, s.username.replace('@', '')), ilike(users.displayName, `%${s.username.replace('@', '')}%`)) });
      if (!u) return JSON.stringify({ error: `User @${s.username} not found.` });
      finalSplits.push({ userId: u.id, amount: s.amount });
    }

    await updateExpense({
      expenseId,
      title,
      totalAmount,
      paidBy: payerUser.id,
      splits: finalSplits
    });

    return JSON.stringify({ success: true, message: `Expense updated to ${title} for ₹${totalAmount}.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_get_poll_details(args: any) {
  try {
    const poll = await db.query.polls.findFirst({
      where: ilike(polls.question, `%${args.pollQuestion}%`),
      with: { creator: true, options: { with: { votes: { with: { user: true } } } } }
    });
    
    if (!poll) return JSON.stringify({ error: `Poll matching '${args.pollQuestion}' not found.` });

    return JSON.stringify({
      question: poll.question,
      creator: poll.creator?.username,
      isAnonymous: poll.isAnonymous,
      options: poll.options.map((o: any) => ({
        label: o.label,
        votes: o.votes.length,
        voters: poll.isAnonymous ? ['REDACTED (anonymous)'] : o.votes.map((v: any) => v.user?.username)
      }))
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_blast_event(args: any) {
  try {
    const { blastEventToWing } = await import('./events');
    const existingEvent = await db.query.events.findFirst({
      where: ilike(events.title, `%${args.eventName}%`),
      orderBy: [desc(events.createdAt)]
    });
    
    if (existingEvent) {
      await blastEventToWing(existingEvent.id);
      return JSON.stringify({ success: true, message: `Successfully blasted event '${existingEvent.title}' to the wing.` });
    } else {
      return JSON.stringify({ error: `Event matching '${args.eventName}' not found.` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}
