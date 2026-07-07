import { db, events, expenses, debts, users, matchParticipants, matches, games, polls, pollOptions, pollVotes, systemLeaks, rsvps } from '@/lib/db'
import { eq, or, ilike, and, desc, sql } from 'drizzle-orm'
import { createEvent, updateEvent, addMicroEvent, deleteEvent, archiveEvent, toggleEventPin } from '@/lib/actions/events'
import { logMatch, autoSplitCricketTeams, getCricketStatsForPlayers } from '@/lib/actions/matches'
import { addExpense, getSimplifiedSettlements } from '@/lib/actions/expenses'
import { createStandalonePoll, deletePoll, archivePoll, togglePollPin } from '@/lib/actions/polls'
import { queryMistral } from '@/lib/mistral'
import { requireDbUser } from '@/lib/auth'
import { logSystemLeak } from '@/lib/activity'
import { getAnalyticsData } from '@/lib/actions/analytics'

export const aiToolsConfig = [
  {
    type: 'function',
    function: {
      name: 'resolve_username_typos',
      description: 'Call this tool FIRST whenever the user mentions people\'s names in their prompt. This tool will return the definitive list of all registered users (usernames and display names) in the system, so you can accurately map any real names, nicknames, or typos to the correct database @username before executing other tools. You MUST roast the user in your final response if they misspelled a name or used a real name.',
      parameters: {
        type: 'object',
        properties: {
          fuzzyNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'The list of names the user mentioned.'
          }
        },
        required: ['fuzzyNames']
      }
    }
  },
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
      description: 'Calculates predicted odds of winning between two players OR two teams in a specific game. Performs head-to-head and overall stat simulations.',
      parameters: {
        type: 'object',
        properties: {
          player1: { type: 'string', description: 'Single username/display name or a comma-separated list of usernames for Team 1.' },
          player2: { type: 'string', description: 'Single username/display name or a comma-separated list of usernames for Team 2.' },
          gameName: { type: 'string', description: 'Name of the game (e.g. FIFA, Poker, Cricket, Badminton)' }
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
  },
  {
    type: 'function',
    function: {
      name: 'query_ongoing_matches',
      description: 'Fetch all active/ongoing matches currently being played (e.g. Cricket, Badminton, Cards, Poker). Use this to see what matches are currently live.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'change_cricket_role',
      description: 'Changes the cricket role (e.g. batsman, bowler) of a user.',
      parameters: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username of the player.' },
          role: { type: 'string', description: 'The role to set: batsman, bowler, batting_all_rounder, bowling_all_rounder, wicket_keeper' }
        },
        required: ['username', 'role']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'split_cricket_teams',
      description: 'Auto-splits a list of usernames into balanced cricket teams using stats, roles and AI logic.',
      parameters: {
        type: 'object',
        properties: {
          usernames: { type: 'array', items: { type: 'string' } }
        },
        required: ['usernames']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'start_cricket_match',
      description: 'Starts a new ongoing cricket match with the provided squads and toss outcome.',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['T20', 'ODI', 'Test'] },
          maxOvers: { type: 'number' },
          team1Name: { type: 'string' },
          team2Name: { type: 'string' },
          team1Players: { type: 'array', items: { type: 'string' } },
          team2Players: { type: 'array', items: { type: 'string' } },
          commonPlayer: { type: 'string', description: 'Optional common player username' },
          tossWinner: { type: 'string', description: 'Name of team that won toss' },
          battingFirst: { type: 'string', description: 'Name of team that bats first' }
        },
        required: ['format', 'maxOvers', 'team1Name', 'team2Name', 'team1Players', 'team2Players', 'tossWinner', 'battingFirst']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'propose_debt_restructuring',
      description: 'Analyzes the entire debt ledger and proposes a minimized debt graph to settle all debts efficiently.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'audit_expense_fraud',
      description: 'Fetches recent expenses and runs an AI audit to identify who is leeching, not paying, or splitting unfairly.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_trip_itinerary',
      description: 'Generates a full trip itinerary with micro-events based on a prompt, and creates them in the DB.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Vague user request, e.g. "Goa for 3 days"' }
        },
        required: ['prompt']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'predict_flake_probability',
      description: 'Analyzes a users RSVP history to predict how likely they are to bail on the next event.',
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
      name: 'generate_live_commentary',
      description: 'Fetches the current active matches and generates toxic sports commentary based on the logs.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'poker_fish_analysis',
      description: 'Analyzes poker ledger history to identify the Shark and the Fish.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_wing_vibe',
      description: 'Analyzes recent polls, RSVPs, and matches to calculate the wings current morale/vibe.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'issue_wing_fine',
      description: 'Issues a financial fine against a user. The fine is owed to the user running the command.',
      parameters: {
        type: 'object',
        properties: {
          targetUsername: { type: 'string' },
          reason: { type: 'string' },
          amount: { type: 'number' },
          issuerUsername: { type: 'string', description: 'The user executing the fine.' }
        },
        required: ['targetUsername', 'reason', 'amount', 'issuerUsername']
      }
    }
  }
];

export async function executeAiTool(name: string, args: any) {
  try {
    switch (name) {
      case 'resolve_username_typos': return await ai_resolve_username_typos(args);
      case 'search_vault': return await search_vault(args.searchQuery);
      case 'get_vault_trip_expenses': return await get_vault_trip_expenses(args.eventId);
      case 'get_user_financials': return await get_user_financials(args.username);
      case 'query_game_tracker': return await query_game_tracker();
      case 'query_active_events': return await query_active_events();
      case 'query_polls': return await query_polls();
      case 'query_ongoing_matches': return await query_ongoing_matches();
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
        case 'change_cricket_role': return await ai_change_cricket_role(args);
        case 'split_cricket_teams': return await ai_split_cricket_teams(args);
        case 'start_cricket_match': return await ai_start_cricket_match(args);
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
      
      case 'propose_debt_restructuring': return await ai_propose_debt_restructuring();
      case 'audit_expense_fraud': return await ai_audit_expense_fraud();
      case 'generate_trip_itinerary': return await ai_generate_trip_itinerary(args);
      case 'predict_flake_probability': return await ai_predict_flake_probability(args);
      case 'generate_live_commentary': return await ai_generate_live_commentary();
      case 'poker_fish_analysis': return await ai_poker_fish_analysis();
      case 'analyze_wing_vibe': return await ai_analyze_wing_vibe();
      case 'issue_wing_fine': return await ai_issue_wing_fine(args);

      default: return JSON.stringify({ error: `Tool ${name} not found.` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `System Error executing ${name}: ${err.message}` });
  }
}

// --------------------------------------------------------------------------------
// EXISTING TOOLS
// --------------------------------------------------------------------------------


async function getLoreRoastsForUsers(usernames: string[]): Promise<string> {
  try {
    if (usernames.length === 0) return "";
    const cleanNames = usernames.map(u => u.trim().replace('@', ''));
    const leaks: any[] = [];
    for (const name of cleanNames) {
      const matched = await db.query.systemLeaks.findMany({
        where: ilike(systemLeaks.memberName, `%${name}%`)
      });
      leaks.push(...matched);
    }
    if (leaks.length === 0) return "";
    const leak = leaks[Math.floor(Math.random() * leaks.length)];
    return `[LORE DOSSIER ROAST ALERT: @${leak.memberName} - ${leak.title}: "${leak.body}"]`;
  } catch (e) {
    return "";
  }
}

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

async function query_ongoing_matches() {
  const ongoing = await db.query.matches.findMany({
    where: eq(matches.status, 'ongoing'),
    with: { game: true, participants: { with: { user: true } }, cricketMatches: true }
  });
  if (ongoing.length === 0) return JSON.stringify({ message: "No ongoing matches right now." });
  return JSON.stringify(ongoing.map((m: any) => ({
    id: m.id,
    game: m.game?.name,
    notes: m.notes,
    playedAt: m.playedAt,
    cricketDetails: m.cricketMatches?.[0] ? {
      format: m.cricketMatches[0].format,
      maxOvers: m.cricketMatches[0].maxOvers,
      team1Name: m.cricketMatches[0].team1Name,
      team2Name: m.cricketMatches[0].team2Name,
      tossWinner: m.cricketMatches[0].tossWinner,
      battingFirst: m.cricketMatches[0].battingFirst
    } : null,
    participants: m.participants.map((p: any) => ({
      username: p.user?.username,
      teamName: p.teamName
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
  // Find active/ongoing matches first to resolve context
  const ongoingMatch = await db.query.matches.findFirst({
    where: eq(matches.status, 'ongoing'),
    with: { game: true, participants: { with: { user: true } }, cricketMatches: { with: { innings: true } } }
  });

  // 1. Resolve players for Team 1 and Team 2, considering team names
  const resolveTeam = async (inputStr: string) => {
    // A. Check if the string matches an ongoing match participant team Name
    if (ongoingMatch) {
      const matchParts = ongoingMatch.participants.filter(
        p => p.teamName?.toLowerCase() === inputStr.toLowerCase() || p.teamName?.toLowerCase() === inputStr.trim().toLowerCase()
      );
      if (matchParts.length > 0) {
        return matchParts.map(p => p.user).filter(Boolean);
      }
    }

    // B. Check if it matches any past participant team name globally
    const teamParticipants = await db.query.matchParticipants.findMany({
      where: ilike(matchParticipants.teamName, inputStr),
      with: { user: true }
    });
    if (teamParticipants.length > 0) {
      const uniqueUsers: any[] = [];
      const seenIds = new Set();
      teamParticipants.forEach(tp => {
        if (tp.user && !seenIds.has(tp.user.id)) {
          seenIds.add(tp.user.id);
          uniqueUsers.push(tp.user);
        }
      });
      return uniqueUsers;
    }

    // C. Fallback to comma-separated usernames
    const names = inputStr.split(',').map(n => n.trim().replace('@', '')).filter(Boolean);
    const usersList: any[] = [];
    for (const name of names) {
      const u = await db.query.users.findFirst({
        where: or(eq(users.username, name), ilike(users.displayName, `%${name}%`))
      });
      if (u) usersList.push(u);
    }
    return usersList;
  };

  const t1 = await resolveTeam(player1);
  const t2 = await resolveTeam(player2);

  if (t1.length === 0 || t2.length === 0) {
    return JSON.stringify({ error: "One or both teams contain no valid users." });
  }

  const t1Ids = t1.map(u => u.id);
  const t2Ids = t2.map(u => u.id);

  // 2. Fetch all match participations with games
  const allParticipations = await db.query.matchParticipants.findMany({
    with: { match: { with: { game: true } }, user: true }
  });

  // 3. Calculate overall individual win rates for Team 1 and Team 2 in this game, 
  // falling back to across all games if they have never played this game.
  const getPlayerStats = (userId: string) => {
    let winsGame = 0, totalGame = 0;
    let winsOverall = 0, totalOverall = 0;

    allParticipations.forEach((p: any) => {
      if (p.userId === userId) {
        totalOverall++;
        if (p.isWinner) winsOverall++;

        if (p.match?.game?.name?.toLowerCase() === gameName.toLowerCase()) {
          totalGame++;
          if (p.isWinner) winsGame++;
        }
      }
    });

    const rate = totalGame > 0 ? winsGame / totalGame : (totalOverall > 0 ? winsOverall / totalOverall : 0.5); // default to 50% if brand new
    return { rate, totalGame, totalOverall };
  };

  const t1Stats = t1.map(u => getPlayerStats(u.id));
  const t2Stats = t2.map(u => getPlayerStats(u.id));

  let t1OddsScore = t1Stats.reduce((sum, s) => sum + s.rate, 0) / t1Stats.length;
  let t2OddsScore = t2Stats.reduce((sum, s) => sum + s.rate, 0) / t2Stats.length;

  const t1AvgWinRate = t1OddsScore;
  const t2AvgWinRate = t2OddsScore;

  // 4. Calculate direct Head-to-Head (H2H) records between Team 1 and Team 2 in this game.
  // Group participations by matchId
  const matchGroups: Record<string, { t1Winners: number, t1Losers: number, t2Winners: number, t2Losers: number }> = {};
  
  allParticipations.forEach((p: any) => {
    if (p.match?.game?.name?.toLowerCase() === gameName.toLowerCase()) {
      const matchId = p.matchId;
      if (!matchGroups[matchId]) {
        matchGroups[matchId] = { t1Winners: 0, t1Losers: 0, t2Winners: 0, t2Losers: 0 };
      }
      
      const isT1 = t1Ids.includes(p.userId);
      const isT2 = t2Ids.includes(p.userId);
      
      if (isT1) {
        if (p.isWinner) matchGroups[matchId].t1Winners++;
        else matchGroups[matchId].t1Losers++;
      } else if (isT2) {
        if (p.isWinner) matchGroups[matchId].t2Winners++;
        else matchGroups[matchId].t2Losers++;
      }
    }
  });

  let t1H2HWins = 0;
  let t2H2HWins = 0;
  let h2hTotal = 0;

  for (const mg of Object.values(matchGroups)) {
    // Only count if there was at least one player from T1 and at least one from T2 playing against each other
    const hasT1 = mg.t1Winners > 0 || mg.t1Losers > 0;
    const hasT2 = mg.t2Winners > 0 || mg.t2Losers > 0;
    
    if (hasT1 && hasT2) {
      h2hTotal++;
      // Determine match outcome: if T1 players won, T1 wins. If T2 players won, T2 wins.
      if (mg.t1Winners > 0 && mg.t2Winners === 0) {
        t1H2HWins++;
      } else if (mg.t2Winners > 0 && mg.t1Winners === 0) {
        t2H2HWins++;
      }
    }
  }

  let h2hVerdict = "No historical head-to-head records found between these teams in " + gameName + ".";

  if (h2hTotal > 0) {
    const h2hWeight = Math.min(h2hTotal * 0.15, 0.6); // Up to 60% weight on head-to-head history
    const t1H2HRate = t1H2HWins / h2hTotal;
    const t2H2HRate = t2H2HWins / h2hTotal;
    
    t1OddsScore = (t1AvgWinRate * (1 - h2hWeight)) + (t1H2HRate * h2hWeight);
    t2OddsScore = (t2AvgWinRate * (1 - h2hWeight)) + (t2H2HRate * h2hWeight);

    h2hVerdict = `Head-to-head record in ${gameName}: Team 1 won ${t1H2HWins} times, Team 2 won ${t2H2HWins} times.`;
  }

  // 5. Fetch Degen Factors (debts & RSVPs) and apply adjustment
  const getDegenFactors = async (usersList: any[]) => {
    let totalDebt = 0;
    let shortCount = 0;
    let longCount = 0;
    const userDetails: string[] = [];

    for (const u of usersList) {
      // Debts
      const pendingDebts = await db.query.debts.findMany({
        where: and(eq(debts.fromUser, u.id), eq(debts.status, 'pending'))
      });
      const uDebt = pendingDebts.reduce((sum, d) => sum + Number(d.amount), 0);
      totalDebt += uDebt;

      // RSVPs
      const userRsvps = await db.query.rsvps.findMany({
        where: eq(rsvps.userId, u.id)
      });
      const uShort = userRsvps.filter(r => r.status === 'short' || r.status === 'hedge').length;
      const uLong = userRsvps.filter(r => r.status === 'long').length;
      shortCount += uShort;
      longCount += uLong;

      const traits = [];
      if (uDebt > 0) traits.push(`₹${uDebt} debt`);
      if (uShort > 0) traits.push(`${uShort} grinds`);
      if (uLong > 0) traits.push(`${uLong} parties`);
      userDetails.push(`@${u.username} (${traits.join(', ') || 'clean record'})`);
    }

    // Party penalty: -2% per event (max -10% total)
    // Grind bonus: +3% per event (max +15% total)
    // Debt distress penalty: -1.5% per 1000 INR (max -20% total)
    const partyPenalty = Math.min(10, longCount * 2.0);
    const grindBonus = Math.min(15, shortCount * 3.0);
    const debtPenalty = Math.min(20, (totalDebt / 1000) * 1.5);
    const netAdjustment = grindBonus - partyPenalty - debtPenalty;

    return {
      totalDebt,
      shortCount,
      longCount,
      netAdjustment,
      details: userDetails.join(' | ')
    };
  };

  const t1Degen = await getDegenFactors(t1);
  const t2Degen = await getDegenFactors(t2);

  // Apply degen factors
  t1OddsScore = Math.max(0.05, t1OddsScore + (t1Degen.netAdjustment / 100));
  t2OddsScore = Math.max(0.05, t2OddsScore + (t2Degen.netAdjustment / 100));

  // Scale to percentages
  const sumOdds = t1OddsScore + t2OddsScore;
  let t1Odds = 50, t2Odds = 50;
  if (sumOdds > 0) {
    t1Odds = (t1OddsScore / sumOdds) * 100;
    t2Odds = (t2OddsScore / sumOdds) * 100;
  }

  // 5.5. Cricket-Specific Stats adjustment
  let cricketStatsVerdict = "";
  if (gameName.toLowerCase() === 'cricket') {
    const t1CricketStats = await getCricketStatsForPlayers(t1Ids);
    const t2CricketStats = await getCricketStatsForPlayers(t2Ids);

    const calcTeamSkill = (statsObj: Record<string, any>) => {
      let totalSkill = 0;
      Object.values(statsObj).forEach((s: any) => {
        const rAvg = parseFloat(s.recent.avg) || 0;
        const rSr = parseFloat(s.recent.sr) || 0;
        const rWkts = s.recent.wickets || 0;
        const rEcon = parseFloat(s.recent.econ) || 0;
        const aAvg = parseFloat(s.allTime.avg) || 0;
        const aSr = parseFloat(s.allTime.sr) || 0;
        const aWkts = s.allTime.wickets || 0;
        const aEcon = parseFloat(s.allTime.econ) || 0;

        // Weight recent form more (60%) than all-time form (40%)
        const avgAvg = (rAvg * 0.6) + (aAvg * 0.4);
        const avgSr = (rSr * 0.6) + (aSr * 0.4);
        const wktMetric = (rWkts * 0.6) + (aWkts * 0.4);
        const econMetric = rEcon > 0 ? ((rEcon * 0.6) + (aEcon * 0.4)) : aEcon;

        // Batting rating: Average + (Strike Rate / 2)
        const batRating = avgAvg + (avgSr / 2);
        
        // Bowling rating: Wickets * 10 + (Econ > 0 ? (120 / Econ) : 0)
        const bowlRating = (wktMetric * 10) + (econMetric > 0 ? (120 / econMetric) : 0);

        totalSkill += batRating + bowlRating;
      });
      return totalSkill;
    };

    const t1Skill = calcTeamSkill(t1CricketStats);
    const t2Skill = calcTeamSkill(t2CricketStats);

    const totalSkill = t1Skill + t2Skill;
    if (totalSkill > 0) {
      // Scale skill to a percentage bonus, max 15% shift
      const t1SkillPct = t1Skill / totalSkill;
      const t1Shift = (t1SkillPct - 0.5) * 30; // Max 15% diff in either direction (30 * 0.5 = 15)
      
      t1Odds += t1Shift;
      t2Odds -= t1Shift;

      // Clamp odds
      t1Odds = Math.max(5, Math.min(95, t1Odds));
      t2Odds = 100 - t1Odds;

      cricketStatsVerdict = `Cricket Stats Adjusted: T1 Skill ${Math.round(t1Skill)} vs T2 Skill ${Math.round(t2Skill)} based on batting & bowling records.`;
    }
  }

  // Format outputs
  const t1Names = t1.map(u => `@${u.username}`).join(', ');
  const t2Names = t2.map(u => `@${u.username}`).join(', ');

  // 6. Check for Live In-Play ongoing match data
  let liveInPlayDetails: any = null;
  let liveT1Prob = t1Odds;
  let liveT2Prob = t2Odds;

  if (ongoingMatch && ongoingMatch.game?.name?.toLowerCase() === gameName.toLowerCase()) {
    const cm = ongoingMatch.cricketMatches?.[0];
    if (cm && cm.innings && cm.innings.length > 0) {
      const sortedInnings = [...cm.innings].sort((a, b) => a.inningNumber - b.inningNumber);
      const activeInning = sortedInnings[sortedInnings.length - 1];
      
      if (activeInning.inningNumber === 1) {
        // Inning 1 in progress: predict based on projected score
        const maxOvers = cm.maxOvers || 20;
        const currentOvers = activeInning.totalOvers || 0;
        const currentRuns = activeInning.totalRuns || 0;
        const currentWickets = activeInning.totalWickets || 0;
        
        const crr = currentOvers > 0 ? currentRuns / currentOvers : 6.0;
        const projected = Math.round(crr * maxOvers);
        
        // standard baseline score 140
        const diff = projected - 140;
        // Adjust probabilities (taking degen factors into account too)
        let liveScoreAdjustment = diff * 0.4 - currentWickets * 3;
        liveScoreAdjustment = Math.max(-40, Math.min(40, liveScoreAdjustment));
        
        // Find which team is batting in inning 1
        const battingTeamIsT1 = t1.some(u => ongoingMatch.participants.some(p => p.userId === u.id && p.teamName === activeInning.battingTeam));
        
        if (battingTeamIsT1) {
          liveT1Prob += liveScoreAdjustment;
          liveT2Prob -= liveScoreAdjustment;
        } else {
          liveT2Prob += liveScoreAdjustment;
          liveT1Prob -= liveScoreAdjustment;
        }
        
        // Clamp
        liveT1Prob = Math.max(5, Math.min(95, liveT1Prob));
        liveT2Prob = 100 - liveT1Prob;

        liveInPlayDetails = {
          status: `Inning 1 in progress: ${activeInning.battingTeam} is batting`,
          score: `${currentRuns}/${currentWickets} in ${currentOvers.toFixed(1)} overs`,
          run_rate: crr.toFixed(2),
          projected_score: projected,
          live_odds_t1: `${liveT1Prob.toFixed(1)}%`,
          live_odds_t2: `${liveT2Prob.toFixed(1)}%`
        };
      } else if (activeInning.inningNumber === 2) {
        // Inning 2 in progress: predict based on target and balls/wickets remaining
        const maxOvers = cm.maxOvers || 20;
        const target = (sortedInnings[0]?.totalRuns || 0) + 1;
        const currentRuns = activeInning.totalRuns || 0;
        const currentWickets = activeInning.totalWickets || 0;
        const currentOvers = activeInning.totalOvers || 0;
        
        const runsNeeded = target - currentRuns;
        const totalBalls = maxOvers * 6;
        const currentBalls = Math.round(currentOvers * 6);
        const ballsRemaining = Math.max(0, totalBalls - currentBalls);
        const oversRemaining = ballsRemaining / 6;
        
        const battingTeamParticipants = ongoingMatch.participants.filter(p => p.teamName === activeInning.battingTeam);
        const maxWickets = Math.max(1, Math.min(10, battingTeamParticipants.length - 1));
        const wicketsRemaining = Math.max(0, maxWickets - currentWickets);
        
        let chaseProb = 50;
        
        if (runsNeeded <= 0) {
          chaseProb = 100;
        } else if (ballsRemaining <= 0 || wicketsRemaining <= 0) {
          chaseProb = 0;
        } else {
          const rrr = runsNeeded / oversRemaining;
          const crr = currentOvers > 0 ? currentRuns / currentOvers : 6.0;
          
          // Penalty for high RRR
          chaseProb -= (rrr - crr) * 8;
          // Adjustment for wickets in hand
          chaseProb += (wicketsRemaining - (maxWickets / 2)) * 12;
          
          chaseProb = Math.max(5, Math.min(95, chaseProb));
        }

        // Blend with historical team strength
        const historicalWeight = 0.25;
        // Identify which team is batting in Inning 2
        const battingTeamIsT1 = t1.some(u => ongoingMatch.participants.some(p => p.userId === u.id && p.teamName === activeInning.battingTeam));
        
        if (battingTeamIsT1) {
          liveT1Prob = (chaseProb * (1 - historicalWeight)) + (t1Odds * historicalWeight);
          liveT2Prob = 100 - liveT1Prob;
        } else {
          liveT2Prob = (chaseProb * (1 - historicalWeight)) + (t2Odds * historicalWeight);
          liveT1Prob = 100 - liveT2Prob;
        }

        liveInPlayDetails = {
          status: `Inning 2 in progress: ${activeInning.battingTeam} is chasing`,
          score: `${currentRuns}/${currentWickets} in ${currentOvers.toFixed(1)} overs`,
          target: target,
          runs_needed: runsNeeded,
          balls_remaining: ballsRemaining,
          wickets_remaining: wicketsRemaining,
          live_odds_t1: `${liveT1Prob.toFixed(1)}%`,
          live_odds_t2: `${liveT2Prob.toFixed(1)}%`
        };
      }
    }
  }

  // Compile a degen roast summary based on real debts and skip statistics
  let roastSummary = "";
  if (t1Degen.totalDebt > t2Degen.totalDebt && t1Degen.totalDebt > 3000) {
    roastSummary = `Team 1 is financially drowning (owing ₹${t1Degen.totalDebt}). Maybe focus on paying off your creditors before looking for wins.`;
  } else if (t2Degen.totalDebt > t1Degen.totalDebt && t2Degen.totalDebt > 3000) {
    roastSummary = `Team 2 is completely underwater with ₹${t2Degen.totalDebt} in pending debt. Their concentration is compromised by collection threats.`;
  } else if (t1Degen.shortCount > t2Degen.shortCount && t1Degen.shortCount > 1) {
    roastSummary = `Team 1 gets an odds multiplier for skipping ${t1Degen.shortCount} group events to grind. True sweatlords.`;
  } else if (t2Degen.shortCount > t1Degen.shortCount && t2Degen.shortCount > 1) {
    roastSummary = `Team 2 is boosted by ${t2Degen.shortCount} skips. They sacrificed social life to train.`;
  } else {
    roastSummary = "No severe debt or skip discrepancy found. Pure, unadulterated degen skill-off.";
  }

  const t1Usernames = t1.map(u => u.username);
  const t2Usernames = t2.map(u => u.username);
  const loreRoast = await getLoreRoastsForUsers([...t1Usernames, ...t2Usernames]);

  return JSON.stringify({
    game: gameName,
    team1: {
      players: t1Names,
      average_win_rate: `${(t1AvgWinRate * 100).toFixed(1)}%`,
      predicted_odds: `${t1Odds.toFixed(1)}%`,
      live_odds: liveInPlayDetails ? `${liveT1Prob.toFixed(1)}%` : undefined,
      financials_and_grinds: t1Degen.details
    },
    team2: {
      players: t2Names,
      average_win_rate: `${(t2AvgWinRate * 100).toFixed(1)}%`,
      predicted_odds: `${t2Odds.toFixed(1)}%`,
      live_odds: liveInPlayDetails ? `${liveT2Prob.toFixed(1)}%` : undefined,
      financials_and_grinds: t2Degen.details
    },
    h2h_history: h2hVerdict,
    cricket_stats_analysis: cricketStatsVerdict || undefined,
    live_in_play: liveInPlayDetails,
    degen_analysis: roastSummary,
    lore_dossier: loreRoast || undefined,
    verdict: liveInPlayDetails 
      ? `LIVE UPDATE: In-play simulation favors ${liveT1Prob > liveT2Prob ? `Team 1 (${t1Names})` : `Team 2 (${t2Names})`} with ${Math.max(liveT1Prob, liveT2Prob).toFixed(1)}% odds. Degen factor: ${roastSummary} ${loreRoast}`
      : `Simulation favors ${t1Odds > t2Odds ? `Team 1 (${t1Names})` : `Team 2 (${t2Names})`} with ${Math.max(t1Odds, t2Odds).toFixed(1)}% odds. Degen factor: ${roastSummary} ${loreRoast}`
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
    const currentMe = await getCurrentDbUser();
    const lore = currentMe ? await getLoreRoastsForUsers([currentMe.username]) : "";
    return JSON.stringify({ success: true, eventId: ev.id, message: "Event created successfully. " + lore });
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

    // Validate teams if participants are registered
    const cm = cricketMatch.cricketMatches?.[0];
    if (cm) {
      const participants = await db.query.matchParticipants.findMany({
        where: eq(matchParticipants.matchId, cricketMatch.id)
      });
      
      const batterPart = participants.find(p => p.userId === batter.id);
      const bowlerPart = participants.find(p => p.userId === bowler.id);
      
      const battingFirstTeam = cm.battingFirst || cm.team1Name;
      const team1Name = cm.team1Name;
      const team2Name = cm.team2Name;
      
      const currentBattingTeam = args.inningNumber === 1 ? battingFirstTeam : (battingFirstTeam === team1Name ? team2Name : team1Name);
      const currentBowlingTeam = args.inningNumber === 1 ? (battingFirstTeam === team1Name ? team2Name : team1Name) : battingFirstTeam;
      
      if (batterPart?.teamName && batterPart.teamName !== currentBattingTeam) {
        return JSON.stringify({ error: `Batter ${args.battingPlayer} belongs to ${batterPart.teamName}, but ${currentBattingTeam} is batting in Inning ${args.inningNumber}.` });
      }
      if (bowlerPart?.teamName && bowlerPart.teamName !== currentBowlingTeam) {
        return JSON.stringify({ error: `Bowler ${args.bowlingPlayer} belongs to ${bowlerPart.teamName}, but ${currentBowlingTeam} is bowling in Inning ${args.inningNumber}.` });
      }
    }

    await logCricketBatter(cricketMatch.id, args.inningNumber, batter.id, args.runsScored, args.ballsFaced || 0, false);
    await logCricketOver(cricketMatch.id, args.inningNumber, bowler.id, args.runsScored, args.wicketsFallen);

    const lore = await getLoreRoastsForUsers([batter.username, bowler.username]);
    return JSON.stringify({ message: `Logged ${args.runsScored} runs for ${batter.displayName}, and ${args.wicketsFallen} wickets for ${bowler.displayName}. ${lore}` });
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

    const playerUsernames = [];
    for (const p of args.participants) {
      playerUsernames.push(p.playerName);
    }
    const lore = await getLoreRoastsForUsers(playerUsernames);
    return JSON.stringify({ message: `Logged card round ${args.roundNumber} successfully. ${lore}` });
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

    const pList = [t1p1?.username, t1p2?.username, t2p1?.username, t2p2?.username].filter(Boolean) as string[];
    const lore = await getLoreRoastsForUsers(pList);
    return JSON.stringify({ message: `Logged badminton set ${args.setNumber} successfully. ${lore}` });
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
    const transactionUsers = [payer.username, ...args.splits.map((s: any) => s.username)];
    const lore = await getLoreRoastsForUsers(transactionUsers);
    return JSON.stringify({ success: true, message: `Transaction logged: ${args.title} for ₹${args.totalAmount}${attachMsg} ${lore}` });
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
    const result = allMembers.map((m: any) => `@${m.username} (${m.displayName}) - Role: ${m.cricketRole || 'Unassigned'}`);
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

async function ai_change_cricket_role(args: any) {
  try {
    const targetUser = await db.query.users.findFirst({
      where: ilike(users.username, args.username)
    });
    if (!targetUser) return JSON.stringify({ error: `User @${args.username} not found.` });

    const validRoles = ['batsman', 'bowler', 'batting_all_rounder', 'bowling_all_rounder', 'wicket_keeper'];
    if (!validRoles.includes(args.role)) {
      return JSON.stringify({ error: `Invalid role '${args.role}'. Valid roles are: ${validRoles.join(', ')}.` });
    }

    await db.update(users).set({ cricketRole: args.role as any }).where(eq(users.id, targetUser.id));
    return JSON.stringify({ success: true, message: `Changed @${targetUser.username}'s cricket role to ${args.role}.` });
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

async function ai_split_cricket_teams(args: any) {
  try {
    const splitResult = await autoSplitCricketTeams(args.usernames);
    return JSON.stringify(splitResult);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_start_cricket_match(args: any) {
  try {
    const cricketGame = await db.query.games.findFirst({ where: eq(games.name, 'Cricket') });
    if (!cricketGame) return JSON.stringify({ error: "Cricket game not found" });

    const participants = [];
    
    // Resolve user IDs
    for (const uname of args.team1Players || []) {
      const cleanName = uname.replace('@', '');
      const u = await db.query.users.findFirst({ where: ilike(users.username, cleanName) });
      if (u) participants.push({ userId: u.id, teamName: args.team1Name });
    }
    for (const uname of args.team2Players || []) {
      const cleanName = uname.replace('@', '');
      const u = await db.query.users.findFirst({ where: ilike(users.username, cleanName) });
      if (u) participants.push({ userId: u.id, teamName: args.team2Name });
    }
    if (args.commonPlayer) {
      const cleanName = args.commonPlayer.replace('@', '');
      const u = await db.query.users.findFirst({ where: ilike(users.username, cleanName) });
      if (u) participants.push({ userId: u.id, teamName: 'Common' });
    }

    await logMatch({
      gameId: cricketGame.id,
      participants,
      status: 'ongoing',
      format: args.format,
      maxOvers: args.maxOvers,
      team1Name: args.team1Name,
      team2Name: args.team2Name,
      tossWinner: args.tossWinner,
      battingFirst: args.battingFirst
    });

    return JSON.stringify({ success: true, message: `Started ${args.format} match between ${args.team1Name} and ${args.team2Name} with toss winner ${args.tossWinner} batting first: ${args.battingFirst}.` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_propose_debt_restructuring() {
  try {
    const settlements = await getSimplifiedSettlements();
    if (settlements.length === 0) return JSON.stringify({ message: "No pending debts to restructure!" });

    const prompt = `Here is the simplified debt graph for the wing: ${JSON.stringify(settlements)}.
Provide a highly toxic summary of who owes what to whom, and relentlessly mock the people who are holding the most debt (or basically who are dragging down the wing's economy). Return the summary as a string.`;

    const roast = await queryMistral([
      { role: 'system', content: 'You are a toxic AI debt collector and financial auditor for a friend group.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({
      suggestedTransactions: settlements,
      auditReport: roast
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_audit_expense_fraud() {
  try {
    const recentExpenses = await db.query.expenses.findMany({
      orderBy: [desc(expenses.createdAt)],
      limit: 30,
      with: { payer: true, splits: { with: { user: true } } }
    });

    const slimData = recentExpenses.map(e => ({
      title: e.title,
      total: e.totalAmount,
      payer: e.payer?.username,
      splits: e.splits.map(s => ({ user: s.user?.username, amount: s.amount }))
    }));

    const prompt = `Analyze these recent 30 expenses for our friend group: ${JSON.stringify(slimData)}.
Identify patterns: Who always pays? Who is always leeching by getting splits but never paying the main bill? Are there any hilariously unequal splits?
Generate a highly toxic financial audit report naming names and shaming the freeloaders. Return the report as plain text.`;

    const report = await queryMistral([
      { role: 'system', content: 'You are a toxic AI forensic accountant for a friend group.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ auditReport: report });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_generate_trip_itinerary(args: any) {
  try {
    const prompt = `The user wants a trip/outing based on this description: "${args.prompt}".
Generate a structured JSON itinerary containing a 'title' for the main trip, a 'location' for the main trip, and an array of 'microEvents', where each microEvent has a 'title' and 'location'.
The locations must be vaguely matched to our categories if possible (e.g. 'other' or a custom string, but for 'location' we usually use 'other' and put the real location in 'locationCustom').
Format: { "title": "Trip to Goa", "location": "other", "locationCustom": "Goa", "microEvents": [ { "title": "Beach party", "location": "other", "locationCustom": "Baga Beach" } ] }`;

    const responseText = await queryMistral([
      { role: 'system', content: 'You are a toxic AI party planner who makes unhinged but syntactically correct trip itineraries. Return STRICT JSON.' },
      { role: 'user', content: prompt }
    ]);
    
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    
    const parsed = JSON.parse(cleaned.trim());

    const createdEvent = await createEvent({
      title: parsed.title,
      category: 'trip',
      location: 'other',
      locationCustom: parsed.locationCustom || parsed.location || 'Unknown',
      microEvents: parsed.microEvents || []
    });

    return JSON.stringify({ success: true, message: `Created trip '${parsed.title}' with ${parsed.microEvents?.length || 0} micro-events.`, eventId: createdEvent.id });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_predict_flake_probability(args: any) {
  try {
    const targetUser = await db.query.users.findFirst({ where: ilike(users.username, args.username) });
    if (!targetUser) return JSON.stringify({ error: "User not found" });

    const userRsvps = await db.query.rsvps.findMany({
      where: eq(rsvps.userId, targetUser.id),
      with: { event: true }
    });

    const slimRsvps = userRsvps.map((r: any) => ({
      eventTitle: r.event?.title,
      status: r.status
    }));

    const prompt = `Analyze this user's RSVP history: ${JSON.stringify(slimRsvps)}.
Calculate their 'flake percentage' (how often they don't say 'going' or say 'not_going' to events).
Generate a toxic roast predicting how likely they are to bail on the next event based on this data. Return plain text.`;

    const roast = await queryMistral([
      { role: 'system', content: 'You are a toxic AI behavioral analyst.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ flakeAnalysis: roast });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_generate_live_commentary() {
  try {
    const ongoingMatches = await db.query.matches.findMany({
      where: eq(matches.status, 'ongoing'),
      with: {
        game: true,
        participants: { with: { user: true } },
        cricketMatches: { with: { innings: { with: { batterLogs: { with: { participant: { with: { user: true } } } }, bowlerLogs: { with: { participant: { with: { user: true } } } } } } } },
        badmintonSets: { with: { player1: true, player2: true } },
        cardRounds: { with: { hands: { with: { participant: { with: { user: true } } } } } },
        pokerLedgers: { with: { participant: { with: { user: true } } } }
      }
    });

    if (ongoingMatches.length === 0) return JSON.stringify({ message: "No ongoing matches to commentate on." });

    const matchData = ongoingMatches.map((m: any) => ({
      game: m.game?.name,
      participants: m.participants.map((p: any) => p.user?.username),
      cricket: m.cricketMatches,
      badminton: m.badmintonSets,
      poker: m.pokerLedgers
    }));

    const prompt = `Here are the currently ongoing matches: ${JSON.stringify(matchData)}.
Act as a highly toxic and biased sports commentator. Generate a live commentary update on how these matches are going, roasting whoever is losing or playing poorly. Return plain text.`;

    const commentary = await queryMistral([
      { role: 'system', content: 'You are a toxic sports commentator for a group of friends.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ liveCommentary: commentary });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_poker_fish_analysis() {
  try {
    const allLedgers = await db.query.pokerLedgers.findMany({
      with: { participant: { with: { user: true } } }
    });

    if (allLedgers.length === 0) return JSON.stringify({ message: "No poker history available." });

    const userNets: Record<string, number> = {};
    for (const l of allLedgers) {
      const uname = l.participant?.user?.username;
      if (!uname) continue;
      const net = l.chipsOut - l.chipsIn;
      userNets[uname] = (userNets[uname] || 0) + net;
    }

    const prompt = `Here is the total net chips (chipsOut - chipsIn) for all players in poker history: ${JSON.stringify(userNets)}.
Identify the "Shark" (highest net) and the absolute "Fish" (lowest net). Generate a toxic poker analysis roasting the fish and giving seating advice on who to sit next to. Return plain text.`;

    const analysis = await queryMistral([
      { role: 'system', content: 'You are a toxic poker pro analyzing a friend group.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ analysis });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_analyze_wing_vibe() {
  try {
    const recentPolls = await db.query.polls.findMany({
      orderBy: [desc(polls.createdAt)],
      limit: 5,
      with: { options: { with: { votes: true } } }
    });

    const recentEvents = await db.query.events.findMany({
      orderBy: [desc(events.createdAt)],
      limit: 5,
      with: { rsvps: true }
    });

    const data = {
      polls: recentPolls.map(p => ({ question: p.question, totalVotes: p.options.reduce((acc: number, o: any) => acc + o.votes.length, 0) })),
      events: recentEvents.map(e => ({ title: e.title, going: e.rsvps.filter((r: any) => r.status === 'going').length }))
    };

    const prompt = `Here is recent data for our friend group: ${JSON.stringify(data)}.
Act as a toxic group psychologist. Tell us what the current "vibe" or morale of the wing is. Are people hyped for events or just rotting away? Return plain text.`;

    const vibe = await queryMistral([
      { role: 'system', content: 'You are a toxic psychologist for a friend group.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ wingVibe: vibe });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_issue_wing_fine(args: any) {
  try {
    const targetUser = await db.query.users.findFirst({ where: ilike(users.username, args.targetUsername) });
    const issuerUser = await db.query.users.findFirst({ where: ilike(users.username, args.issuerUsername) });
    
    if (!targetUser) return JSON.stringify({ error: `User @${args.targetUsername} not found.` });
    if (!issuerUser) return JSON.stringify({ error: `User @${args.issuerUsername} not found. (The person issuing the fine must exist).` });
    if (targetUser.id === issuerUser.id) return JSON.stringify({ error: "You cannot fine yourself." });

    const title = `🚨 WING FINE: ${args.reason}`;
    
    await addExpense({
      title,
      totalAmount: args.amount,
      paidBy: issuerUser.id,
      tag: 'fine',
      splits: [
        { userId: targetUser.id, amount: args.amount }
      ]
    });

    const prompt = `The user @${issuerUser.username} just issued a wing fine of ₹${args.amount} against @${targetUser.username} for "${args.reason}".
Act as an unhinged digital Judge. Issue a toxic "Court Ruling" validating this fine and roasting the defendant. Return plain text.`;

    const ruling = await queryMistral([
      { role: 'system', content: 'You are an unhinged AI Judge for a friend group.' },
      { role: 'user', content: prompt }
    ]);

    return JSON.stringify({ success: true, message: `Fine issued! @${targetUser.username} now owes @${issuerUser.username} ₹${args.amount}.`, courtRuling: ruling });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function ai_resolve_username_typos(args: any) {
  try {
    const { fuzzyNames } = args;
    const allUsers = await db.query.users.findMany({
      columns: { username: true, displayName: true }
    });
    
    let hasTypos = false;
    let roasts = [];
    
    if (fuzzyNames && Array.isArray(fuzzyNames)) {
      for (const name of fuzzyNames) {
        const cleanName = name.replace('@', '').toLowerCase().trim();
        const isUsername = allUsers.some(u => u.username.toLowerCase() === cleanName);
        const isRealName = allUsers.some(u => {
          const first = (u.displayName || '').split(' ')[0].toLowerCase();
          return first === cleanName || (u.displayName || '').toLowerCase() === cleanName;
        });
        
        if (!isUsername && !isRealName) {
          hasTypos = true;
          roasts.push(`You spelled '${name}' wrong. Learn to spell.`);
        }
      }
    }
    
    if (hasTypos) {
      return JSON.stringify({ 
        instruction: `I have detected genuine typos in the user's input. You MUST include this exact roast in your response: "${roasts.join(' ')}"`,
        fuzzyNamesProvided: fuzzyNames,
        registeredUsers: allUsers.map(u => ({ username: u.username, realName: u.displayName }))
      });
    } else {
      return JSON.stringify({ 
        instruction: "All names resolved perfectly to either a username or a real name. There are NO typos. You are STRICTLY FORBIDDEN from mentioning typos or roasting the user for their names.",
        fuzzyNamesProvided: fuzzyNames,
        registeredUsers: allUsers.map(u => ({ username: u.username, realName: u.displayName }))
      });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

