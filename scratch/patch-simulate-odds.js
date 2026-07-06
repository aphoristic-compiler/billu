const fs = require('fs');

const path = 'lib/actions/ai-tools.ts';
let code = fs.readFileSync(path, 'utf8');

const oldSimulateMatchOdds = `async function simulate_match_odds(player1: string, player2: string, gameName: string) {
  // 1. Resolve players for Team 1 and Team 2
  const resolveTeam = async (inputStr: string) => {
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

  const t1AvgWinRate = t1Stats.reduce((sum, s) => sum + s.rate, 0) / t1Stats.length;
  const t2AvgWinRate = t2Stats.reduce((sum, s) => sum + s.rate, 0) / t2Stats.length;

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

  // 5. Predict match odds based on win rates and H2H weights
  let t1OddsScore = t1AvgWinRate;
  let t2OddsScore = t2AvgWinRate;

  let h2hVerdict = "No historical head-to-head records found between these teams in " + gameName + ".";

  if (h2hTotal > 0) {
    const h2hWeight = Math.min(h2hTotal * 0.15, 0.6); // Up to 60% weight on head-to-head history
    const t1H2HRate = t1H2HWins / h2hTotal;
    const t2H2HRate = t2H2HWins / h2hTotal;
    
    t1OddsScore = (t1AvgWinRate * (1 - h2hWeight)) + (t1H2HRate * h2hWeight);
    t2OddsScore = (t2AvgWinRate * (1 - h2hWeight)) + (t2H2HRate * h2hWeight);

    h2hVerdict = \`Head-to-head record in \${gameName}: Team 1 won \${t1H2HWins} times, Team 2 won \${t2H2HWins} times.\`;
  }

  // Scale to percentages
  const sumOdds = t1OddsScore + t2OddsScore;
  let t1Odds = 50, t2Odds = 50;
  if (sumOdds > 0) {
    t1Odds = (t1OddsScore / sumOdds) * 100;
    t2Odds = (t2OddsScore / sumOdds) * 100;
  }

  // Format outputs
  const t1Names = t1.map(u => \`@\${u.username}\`).join(', ');
  const t2Names = t2.map(u => \`@\${u.username}\`).join(', ');

  return JSON.stringify({
    game: gameName,
    team1: {
      players: t1Names,
      average_win_rate: \`\${(t1AvgWinRate * 100).toFixed(1)}%\`,
      predicted_odds: \`\${t1Odds.toFixed(1)}%\`
    },
    team2: {
      players: t2Names,
      average_win_rate: \`\${(t2AvgWinRate * 100).toFixed(1)}%\`,
      predicted_odds: \`\${t2Odds.toFixed(1)}%\`
    },
    h2h_history: h2hVerdict,
    verdict: t1Odds > t2Odds 
      ? \`Team 1 (\${t1Names}) is favored to win with \${t1Odds.toFixed(1)}% odds.\` 
      : t2Odds > t1Odds 
        ? \`Team 2 (\${t2Names}) is favored to win with \${t2Odds.toFixed(1)}% odds.\` 
        : "Too close to call (50/50 odds)."
  });
}`;

const newSimulateMatchOdds = `async function simulate_match_odds(player1: string, player2: string, gameName: string) {
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
        where: or(eq(users.username, name), ilike(users.displayName, '%'+name+'%'))
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

  const t1AvgWinRate = t1Stats.reduce((sum, s) => sum + s.rate, 0) / t1Stats.length;
  const t2AvgWinRate = t2Stats.reduce((sum, s) => sum + s.rate, 0) / t2Stats.length;

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

  // 5. Predict match odds based on win rates and H2H weights
  let t1OddsScore = t1AvgWinRate;
  let t2OddsScore = t2AvgWinRate;

  let h2hVerdict = "No historical head-to-head records found between these teams in " + gameName + ".";

  if (h2hTotal > 0) {
    const h2hWeight = Math.min(h2hTotal * 0.15, 0.6); // Up to 60% weight on head-to-head history
    const t1H2HRate = t1H2HWins / h2hTotal;
    const t2H2HRate = t2H2HWins / h2hTotal;
    
    t1OddsScore = (t1AvgWinRate * (1 - h2hWeight)) + (t1H2HRate * h2hWeight);
    t2OddsScore = (t2AvgWinRate * (1 - h2hWeight)) + (t2H2HRate * h2hWeight);

    h2hVerdict = `Head-to-head record in \${gameName}: Team 1 won \${t1H2HWins} times, Team 2 won \${t2H2HWins} times.`;
  }

  // Scale to percentages
  const sumOdds = t1OddsScore + t2OddsScore;
  let t1Odds = 50, t2Odds = 50;
  if (sumOdds > 0) {
    t1Odds = (t1OddsScore / sumOdds) * 100;
    t2Odds = (t2OddsScore / sumOdds) * 100;
  }

  // Format outputs
  const t1Names = t1.map(u => \`@\${u.username}\`).join(', ');
  const t2Names = t2.map(u => \`@\${u.username}\`).join(', ');

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
        // Adjust probabilities
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
          score: `\${currentRuns}/\${currentWickets} in \${currentOvers.toFixed(1)} overs`,
          run_rate: crr.toFixed(2),
          projected_score: projected,
          live_odds_t1: `\${liveT1Prob.toFixed(1)}%`,
          live_odds_t2: `\${liveT2Prob.toFixed(1)}%`
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
          score: `\${currentRuns}/\${currentWickets} in \${currentOvers.toFixed(1)} overs`,
          target: target,
          runs_needed: runsNeeded,
          balls_remaining: ballsRemaining,
          wickets_remaining: wicketsRemaining,
          live_odds_t1: `\${liveT1Prob.toFixed(1)}%`,
          live_odds_t2: `\${liveT2Prob.toFixed(1)}%`
        };
      }
    }
  }

  return JSON.stringify({
    game: gameName,
    team1: {
      players: t1Names,
      average_win_rate: \`\${(t1AvgWinRate * 100).toFixed(1)}%\`,
      predicted_odds: \`\${t1Odds.toFixed(1)}%\`,
      live_odds: liveInPlayDetails ? `\${liveT1Prob.toFixed(1)}%` : undefined
    },
    team2: {
      players: t2Names,
      average_win_rate: \`\${(t2AvgWinRate * 100).toFixed(1)}%\`,
      predicted_odds: \`\${t2Odds.toFixed(1)}%\`,
      live_odds: liveInPlayDetails ? `\${liveT2Prob.toFixed(1)}%` : undefined
    },
    h2h_history: h2hVerdict,
    live_in_play: liveInPlayDetails,
    verdict: liveInPlayDetails 
      ? (liveT1Prob > liveT2Prob 
          ? \`LIVE UPDATE: Team 1 (\${t1Names}) is currently favored to win with \${liveT1Prob.toFixed(1)}% live odds.\` 
          : liveT2Prob > liveT1Prob 
            ? \`LIVE UPDATE: Team 2 (\${t2Names}) is currently favored to win with \${liveT2Prob.toFixed(1)}% live odds.\` 
            : "LIVE UPDATE: Match is split exactly 50/50!")
      : (t1Odds > t2Odds 
          ? \`Team 1 (\${t1Names}) is favored to win with \${t1Odds.toFixed(1)}% odds.\` 
          : t2Odds > t1Odds 
            ? \`Team 2 (\${t2Names}) is favored to win with \${t2Odds.toFixed(1)}% odds.\` 
            : "Too close to call (50/50 odds)."
        )
  });
}`;

code = code.replace(oldSimulateMatchOdds, newSimulateMatchOdds);

fs.writeFileSync(path, code);
console.log("Patched simulate_match_odds in lib/actions/ai-tools.ts successfully");
