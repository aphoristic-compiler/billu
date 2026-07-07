'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, inArray, and } from 'drizzle-orm'
import { db, games, matches, matchParticipants, users, cricketMatches, cricketInnings, cricketBatterLogs, cricketBowlerLogs, badmintonSets, cardRounds, cardPlayerHands, pokerLedgers } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import { queryMistral } from '@/lib/mistral'

export async function getGamesData() {
  const defaultGames = [
    { name: 'Poker', icon: '🃏', minPlayers: 2, maxPlayers: 12, statSchema: {} },
    { name: 'Cards', icon: '🎴', minPlayers: 2, maxPlayers: 10, statSchema: {} },
    { name: 'Badminton', icon: '🏸', minPlayers: 2, maxPlayers: 4, statSchema: {} },
    { name: 'Cricket', icon: '🏏', minPlayers: 2, maxPlayers: 22, statSchema: {} },
  ]

  let allGames = await db.select().from(games)
  
  for (const gameName of ['Poker', 'Cards', 'Badminton', 'Cricket']) {
    const existing = allGames.find((g: any) => g.name === gameName)
    const def = defaultGames.find(g => g.name === gameName)
    if (!existing) {
      await db.insert(games).values(def as any)
    }
  }
  
  allGames = await db.select().from(games).orderBy(games.name)

  const [allMatches, members] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.isArchived, false),
      orderBy: [desc(matches.playedAt)],
      with: { 
        game: true, 
        participants: { with: { user: true } },
        cricketMatches: { with: { innings: { with: { batterLogs: { with: { participant: { with: { user: true } } } }, bowlerLogs: { with: { participant: { with: { user: true } } } } } } } },
        badmintonSets: { with: { player1: true, player2: true, winner: true }, orderBy: [desc(badmintonSets.setNumber)] },
        cardRounds: { with: { hands: { with: { participant: true } } }, orderBy: [desc(cardRounds.roundNumber)] },
        pokerLedgers: { with: { participant: true } }
      },
    }),
    db.select().from(users).orderBy(users.username),
  ])

  return { games: allGames, matches: allMatches, members }
}

export async function logMatch(input: {
  gameId: string
  participants?: { userId: string; isWinner?: boolean; stats?: any; teamName?: string }[]
  status?: string
  notes?: string
  // Game specific init logic
  format?: string
  maxOvers?: number
  team1Name?: string
  team2Name?: string
  tossWinner?: string
  battingFirst?: string
}) {
  const user = await requireDbUser()
  const [game] = await db.select().from(games).where(eq(games.id, input.gameId))
  if (!game) throw new Error('Game not found')

  const [match] = await db
    .insert(matches)
    .values({
      gameId: input.gameId,
      status: input.status || 'completed',
        notes: input.notes,
        createdBy: user.id,
    })
    .returning()

  // Create participants for all matches if provided
  if (input.participants && input.participants.length > 0) {
    for (const p of input.participants) {
      const [mp] = await db.insert(matchParticipants).values({ 
        matchId: match.id, 
        userId: p.userId, 
        isWinner: p.isWinner || false,
        teamName: p.teamName 
      }).returning()
      if (game.name === 'Poker' && p.stats) {
        await db.insert(pokerLedgers).values({ matchId: match.id, matchParticipantId: mp.id, chipsIn: p.stats.chips_in || 0, chipsOut: p.stats.chips_out || 0 })
      }
    }
  }

  if (game.name === 'Cricket') {
    // Initialize cricket match
    await db.insert(cricketMatches).values({
      matchId: match.id,
      format: input.format || 'T20',
      maxOvers: input.maxOvers || 20,
      team1Name: input.team1Name || 'Team 1',
      team2Name: input.team2Name || 'Team 2',
      tossWinner: input.tossWinner || '',
      battingFirst: input.battingFirst || '',
    })
  }

  await logActivity(user.id, 'match_logged', `[EXEC] Created $${game.name.toUpperCase()} match.`)
  revalidatePath('/hub')
  revalidatePath('/hub/games')
  return match
}

export async function deleteMatch(matchId: string) {
  const user = await requireDbUser()
  await db.delete(matches).where(eq(matches.id, matchId))
  await logActivity(user.id, 'match_deleted', `[LIQUIDATE] Match was deleted.`)
  revalidatePath('/hub')
  revalidatePath('/hub/games')
}

export async function updateCricketMatchSettings(matchId: string, maxOvers: number) {
  const user = await requireDbUser()
  await db.update(matches).set({ maxOvers }).where(eq(matches.id, matchId))
  await db.update(cricketMatches).set({ maxOvers }).where(eq(cricketMatches.matchId, matchId))
  await logActivity(user.id, 'match_updated', `[ADMIN] Updated match overs to ${maxOvers}.`)
  revalidatePath('/hub')
  revalidatePath('/hub/games')
}

export async function archiveMatch(matchId: string) {
  const user = await requireDbUser()
  await db.update(matches).set({ isArchived: true }).where(eq(matches.id, matchId))
  await logActivity(user.id, 'match_vaulted', `[VAULT] Match was vaulted into the archives.`)
  revalidatePath('/hub')
  revalidatePath('/hub/games')
  revalidatePath('/hub/vault')
}

export async function getArchivedMatches() {
  return await db.query.matches.findMany({
    where: eq(matches.isArchived, true),
    orderBy: [desc(matches.playedAt)],
    with: { 
      game: true, 
      participants: { with: { user: true } },
      cricketMatches: { with: { innings: { with: { batterLogs: { with: { participant: { with: { user: true } } } }, bowlerLogs: { with: { participant: { with: { user: true } } } } } } } },
      badmintonSets: { with: { player1: true, player2: true, winner: true }, orderBy: [desc(badmintonSets.setNumber)] },
      cardRounds: { with: { hands: { with: { participant: true } } }, orderBy: [desc(cardRounds.roundNumber)] },
      pokerLedgers: { with: { participant: true } }
    }
  });
}

export async function completeOngoingMatch(matchId: string, manualWinnerIds?: string[]) {
  const user = await requireDbUser()
  
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { 
      game: true, 
      participants: true,
      cricketMatches: { with: { innings: { with: { batterLogs: true, bowlerLogs: true } } } },
      badmintonSets: true,
      cardRounds: { with: { hands: true } },
      pokerLedgers: true
    }
  }) as any;

  if (!match) return;

  await db.update(matches).set({ status: 'completed' }).where(eq(matches.id, matchId))
  
  let winnerParticipantIds: string[] = []

  if (manualWinnerIds && manualWinnerIds.length > 0) {
    winnerParticipantIds = manualWinnerIds
  } else if (match.game.name === 'Cricket' && match.cricketMatches[0]) {
    const cm = match.cricketMatches[0]
    let r1 = 0, r2 = 0;
    for (const inning of cm.innings) {
      if (inning.inningNumber === 1) r1 += inning.totalRuns
      if (inning.inningNumber === 2) r2 += inning.totalRuns
    }

    let battingFirstTeamName = cm.battingFirst || cm.team1Name;
    if (cm.innings && cm.innings.length > 0) {
      const inning1 = cm.innings.find((inng: any) => inng.inningNumber === 1);
      if (inning1) {
        battingFirstTeamName = inning1.battingTeam;
      }
    }
    const battingSecondTeamName = battingFirstTeamName === cm.team1Name ? cm.team2Name : cm.team1Name;

    let winningTeamName = '';
    if (r1 > r2) {
      winningTeamName = battingFirstTeamName;
    } else if (r2 > r1) {
      winningTeamName = battingSecondTeamName;
    }

    if (winningTeamName) {
      winnerParticipantIds = match.participants
        .filter((p: any) => p.teamName === winningTeamName)
        .map((p: any) => p.id);
    }
  } else if (match.game.name === 'Badminton') {
    const userScores: Record<string, number> = {}
    match.badmintonSets.forEach((set: any) => {
      const team1Won = set.score1 > set.score2
      const team2Won = set.score2 > set.score1
      if (team1Won) {
        userScores[set.player1Id] = (userScores[set.player1Id] || 0) + 1
        if (set.team1Player2Id) userScores[set.team1Player2Id] = (userScores[set.team1Player2Id] || 0) + 1
      } else if (team2Won) {
        userScores[set.player2Id] = (userScores[set.player2Id] || 0) + 1
        if (set.team2Player2Id) userScores[set.team2Player2Id] = (userScores[set.team2Player2Id] || 0) + 1
      }
    })
    if (Object.keys(userScores).length > 0) {
      const max = Math.max(...Object.values(userScores))
      winnerParticipantIds = Object.keys(userScores).filter(k => userScores[k] === max)
    }
  } else if (match.game.name === 'Cards') {
    const userScores: Record<string, number> = {}
    match.cardRounds.forEach((r: any) => r.hands.forEach((h: any) => {
      userScores[h.matchParticipantId] = (userScores[h.matchParticipantId] || 0) + h.handsMade
    }))
    if (Object.keys(userScores).length > 0) {
      const max = Math.max(...Object.values(userScores))
      winnerParticipantIds = Object.keys(userScores).filter(k => userScores[k] === max)
    }
  } else if (match.game.name === 'Poker') {
    match.pokerLedgers.forEach((l: any) => {
      if (l.chipsOut > l.chipsIn) winnerParticipantIds.push(l.matchParticipantId)
    })
  }

  if (winnerParticipantIds.length > 0) {
    await db.update(matchParticipants).set({ isWinner: true }).where(inArray(matchParticipants.id, winnerParticipantIds))
  }

  await logActivity(user.id, 'match_logged', `[EXEC] $${match.game.name.toUpperCase()} match completed.`)
  revalidatePath('/hub')
  revalidatePath('/hub/games')
}

// ─── Custom Game Loggers ──────────────────────────────────────────────────

async function getOrCreateParticipant(matchId: string, userId: string) {
  let [mp] = await db.select().from(matchParticipants).where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)))
  if (!mp) {
    [mp] = await db.insert(matchParticipants).values({ matchId, userId }).returning()
  }
  return mp
}

export async function logCricketOver(matchId: string, inningNumber: number, bowlerId: string, runsConceded: number, wicketsTaken: number) {
  // Finds or creates inning
  const [cm] = await db.select().from(cricketMatches).where(eq(cricketMatches.matchId, matchId))
  let [inning] = await db.select().from(cricketInnings).where(and(eq(cricketInnings.cricketMatchId, cm.id), eq(cricketInnings.inningNumber, inningNumber)))
  if (!inning) {
    const batFirst = cm.battingFirst || cm.team1Name || '';
    const batSecond = batFirst === cm.team1Name ? (cm.team2Name || '') : (cm.team1Name || '');
    [inning] = await db.insert(cricketInnings).values({ 
      cricketMatchId: cm.id, 
      inningNumber, 
      battingTeam: inningNumber === 1 ? batFirst : batSecond, 
      bowlingTeam: inningNumber === 1 ? batSecond : batFirst 
    }).returning()
  }

  const bowlerMp = await getOrCreateParticipant(matchId, bowlerId)
  
  let [bowlerLog] = await db.select().from(cricketBowlerLogs).where(and(eq(cricketBowlerLogs.inningId, inning.id), eq(cricketBowlerLogs.matchParticipantId, bowlerMp.id)))
  if (!bowlerLog) {
    [bowlerLog] = await db.insert(cricketBowlerLogs).values({ inningId: inning.id, matchParticipantId: bowlerMp.id, overs: 1, runsConceded, wickets: wicketsTaken }).returning()
  } else {
    // Add overs nicely. e.g. 1.5 + 0.1 = 2.0 (simplification: assume they just bowl full overs for now or just add decimal)
    const currentOvers = Math.floor(bowlerLog.overs)
    const currentBalls = Math.round((bowlerLog.overs - currentOvers) * 10)
    let newBalls = currentBalls + 6; // Assume a full over was logged
    let newOvers = currentOvers + Math.floor(newBalls / 6) + ((newBalls % 6) / 10)
    await db.update(cricketBowlerLogs).set({
      overs: newOvers,
      runsConceded: bowlerLog.runsConceded + runsConceded,
      wickets: bowlerLog.wickets + wicketsTaken
    }).where(eq(cricketBowlerLogs.id, bowlerLog.id))
  }

  // Update inning totals
  await db.update(cricketInnings).set({
    totalRuns: inning.totalRuns + runsConceded,
    totalWickets: inning.totalWickets + wicketsTaken,
    totalOvers: inning.totalOvers + 1
  }).where(eq(cricketInnings.id, inning.id))
}

export async function logCricketBatter(matchId: string, inningNumber: number, batterId: string, runs: number, balls: number, isOut: boolean) {
  const [cm] = await db.select().from(cricketMatches).where(eq(cricketMatches.matchId, matchId))
  let [inning] = await db.select().from(cricketInnings).where(and(eq(cricketInnings.cricketMatchId, cm.id), eq(cricketInnings.inningNumber, inningNumber)))
  if (!inning) {
    const batFirst = cm.battingFirst || cm.team1Name || '';
    const batSecond = batFirst === cm.team1Name ? (cm.team2Name || '') : (cm.team1Name || '');
    [inning] = await db.insert(cricketInnings).values({ 
      cricketMatchId: cm.id, 
      inningNumber, 
      battingTeam: inningNumber === 1 ? batFirst : batSecond, 
      bowlingTeam: inningNumber === 1 ? batSecond : batFirst 
    }).returning()
  }

  const batterMp = await getOrCreateParticipant(matchId, batterId)
  
  let [batterLog] = await db.select().from(cricketBatterLogs).where(and(eq(cricketBatterLogs.inningId, inning.id), eq(cricketBatterLogs.matchParticipantId, batterMp.id)))
  if (!batterLog) {
    await db.insert(cricketBatterLogs).values({ inningId: inning.id, matchParticipantId: batterMp.id, runs, balls, isOut })
  } else {
    await db.update(cricketBatterLogs).set({ runs, balls, isOut }).where(eq(cricketBatterLogs.id, batterLog.id))
  }
}

export async function logBadmintonSet(matchId: string, setNumber: number, team1: string[], score1: number, team2: string[], score2: number) {
  const mp1_1 = await getOrCreateParticipant(matchId, team1[0])
  const mp1_2 = team1[1] ? await getOrCreateParticipant(matchId, team1[1]) : null
  const mp2_1 = await getOrCreateParticipant(matchId, team2[0])
  const mp2_2 = team2[1] ? await getOrCreateParticipant(matchId, team2[1]) : null

  // Winner logic: pick team 1 or team 2 based on score, we just set the first player as the "winnerId" for simplicity in determining match outcome later, or we can use another method. 
  // Wait, if it's doubles, we just need a way to track set wins. Let's just track the first player of the winning team.
  const winnerId = score1 > score2 ? mp1_1.id : score2 > score1 ? mp2_1.id : null

  await db.insert(badmintonSets).values({
    matchId,
    setNumber,
    player1Id: mp1_1.id,
    team1Player2Id: mp1_2?.id,
    score1,
    player2Id: mp2_1.id,
    team2Player2Id: mp2_2?.id,
    score2,
    winnerId
  })
}

export async function logCardsRound(matchId: string, roundNumber: number, playerHands: { userId: string, handsMade: number }[]) {
  const [round] = await db.insert(cardRounds).values({ matchId, roundNumber }).returning()
  for (const ph of playerHands) {
    const mp = await getOrCreateParticipant(matchId, ph.userId)
    await db.insert(cardPlayerHands).values({ cardRoundId: round.id, matchParticipantId: mp.id, handsMade: ph.handsMade })
  }
}

export async function logPokerLedger(matchId: string, userId: string, chipsIn: number, chipsOut: number) {
  const mp = await getOrCreateParticipant(matchId, userId)
  let [ledger] = await db.select().from(pokerLedgers).where(and(eq(pokerLedgers.matchId, matchId), eq(pokerLedgers.matchParticipantId, mp.id)))
  if (ledger) {
    await db.update(pokerLedgers).set({ chipsIn, chipsOut }).where(eq(pokerLedgers.id, ledger.id))
  } else {
    await db.insert(pokerLedgers).values({ matchId, matchParticipantId: mp.id, chipsIn, chipsOut })
  }
}

export async function getCricketStatsForPlayers(userIds: string[]) {
  const statsMap: Record<string, any> = {};
  
  if (!userIds || userIds.length === 0) return statsMap;

  const participations = await db.query.matchParticipants.findMany({
    where: inArray(matchParticipants.userId, userIds),
    with: { 
      cricketBatterLogs: true, 
      cricketBowlerLogs: true,
      user: true,
      match: { columns: { playedAt: true, gameId: true } }
    }
  });

  // Filter only cricket matches (we assume if it has cricket logs it's a cricket match, but let's just group by user)
  const groupedByUser = participations.reduce((acc, p) => {
    if (!acc[p.userId]) acc[p.userId] = [];
    acc[p.userId].push(p);
    return acc;
  }, {} as Record<string, typeof participations>);

  for (const uid of userIds) {
    const parts = groupedByUser[uid] || [];
    if (parts.length === 0) continue;
    
    // Sort by match date descending (most recent first)
    parts.sort((a, b) => new Date(b.match?.playedAt || 0).getTime() - new Date(a.match?.playedAt || 0).getTime());

    const user = parts[0].user;
    if (!user) continue;

    let allTimeRuns = 0;
    let allTimeBalls = 0;
    let allTimeWickets = 0;
    let allTimeRunsGiven = 0;
    let allTimeOvers = 0;
    let allTimeOuts = 0;

    let recentRuns = 0;
    let recentBalls = 0;
    let recentWickets = 0;
    let recentRunsGiven = 0;
    let recentOvers = 0;
    let recentOuts = 0;

    const RECENT_LIMIT = 10;
    let matchCount = 0;

    for (const p of parts) {
      const isRecent = matchCount < RECENT_LIMIT;
      matchCount++;

      for (const b of p.cricketBatterLogs) {
        allTimeRuns += b.runs || 0;
        allTimeBalls += b.balls || 0;
        if (b.isOut) allTimeOuts++;
        if (isRecent) {
          recentRuns += b.runs || 0;
          recentBalls += b.balls || 0;
          if (b.isOut) recentOuts++;
        }
      }

      for (const b of p.cricketBowlerLogs) {
        allTimeWickets += b.wickets || 0;
        allTimeRunsGiven += b.runsGiven || 0;
        allTimeOvers += b.overs || 0;
        if (isRecent) {
          recentWickets += b.wickets || 0;
          recentRunsGiven += b.runsGiven || 0;
          recentOvers += b.overs || 0;
        }
      }
    }

    const calcAvg = (runs: number, outs: number) => outs > 0 ? (runs / outs) : runs;
    const calcSR = (runs: number, balls: number) => balls > 0 ? (runs / balls * 100) : 0;
    const calcEcon = (runsGiven: number, overs: number) => overs > 0 ? (runsGiven / overs) : 0;

    statsMap[uid] = {
      username: user.username,
      role: user.cricketRole || 'Unknown',
      allTime: {
        matches: parts.length,
        avg: calcAvg(allTimeRuns, allTimeOuts).toFixed(1),
        sr: calcSR(allTimeRuns, allTimeBalls).toFixed(1),
        wickets: allTimeWickets,
        econ: calcEcon(allTimeRunsGiven, allTimeOvers).toFixed(1),
      },
      recent: {
        matches: Math.min(parts.length, RECENT_LIMIT),
        avg: calcAvg(recentRuns, recentOuts).toFixed(1),
        sr: calcSR(recentRuns, recentBalls).toFixed(1),
        wickets: recentWickets,
        econ: calcEcon(recentRunsGiven, recentOvers).toFixed(1),
      }
    };
  }

  return statsMap;
}

export async function autoSplitCricketTeams(usernames: string[]) {
  if (usernames.length < 2) throw new Error("Need at least 2 players");
  
  try {
    const cleanNames = usernames.map(u => u.replace('@', ''));
    const players = await db.query.users.findMany({
      where: inArray(users.username, cleanNames),
      columns: { id: true, username: true, cricketRole: true }
    });
    
    const statsMap = await getCricketStatsForPlayers(players.map(p => p.id));
    
    const playersWithStats = players.map(p => {
      const stats = statsMap[p.id];
      if (!stats) return `${p.username} (${p.cricketRole || 'Unknown'} - No history)`;
      return `${p.username} (${stats.role}) | Recent(last 10): Avg ${stats.recent.avg}, SR ${stats.recent.sr}, Wkts ${stats.recent.wickets}, Econ ${stats.recent.econ} | All-time: Avg ${stats.allTime.avg}, SR ${stats.allTime.sr}, Wkts ${stats.allTime.wickets}, Econ ${stats.allTime.econ}`;
    }).join('\n');

    const prompt = `Split these players into two balanced cricket teams based on their historical stats and roles:\n${playersWithStats}\n
CRITICAL: Ensure BOTH teams have an equal mix of batsmen and bowlers. DO NOT put all batsmen on one team and all bowlers on another!
Attempt to balance both batting firepower (Avg, SR) and bowling effectiveness (Wkts, Econ) equally between the two teams. Give recent form (last 10 matches) higher weighting than all-time form.
If there is an odd number of players, assign exactly one as commonPlayer (preferably the best all-rounder).
Return strictly JSON format: { "team1": ["u1"], "team2": ["u2"], "commonPlayer": "u3" | null, "roast": "a witty toxic roast about this selection" }`;
    
    const responseText = await queryMistral([
      { role: 'system', content: 'You are a toxic AI cricket manager and data analyst. Always return JSON.' },
      { role: 'user', content: prompt }
    ]);
    
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    
    const parsed = JSON.parse(cleaned.trim());
    return parsed;
  } catch (err) {
    const t1 = [], t2 = [];
    let common = null;
    const shuffled = [...usernames].sort(() => Math.random() - 0.5);
    if (shuffled.length % 2 !== 0) {
      common = shuffled.pop() || null;
    }
    const mid = Math.floor(shuffled.length / 2);
    return {
      team1: shuffled.slice(0, mid),
      team2: shuffled.slice(mid),
      commonPlayer: common,
      roast: "Mistral AI choked on its own logic, so I just randomly shuffled you bozos."
    };
  }
}
 
