const fs = require('fs');

const path = 'lib/actions/matches.ts';
let code = fs.readFileSync(path, 'utf8');

// First update the interface to accept teamName
code = code.replace(
  `participants?: { userId: string; isWinner?: boolean; stats?: any }[]`,
  `participants?: { userId: string; isWinner?: boolean; stats?: any; teamName?: string }[]`
);

// We need to move the participant creation logic outside the Poker condition so it works for Cricket too.
const oldParticipantLogic = `    // For poker we create participants right away
    if (game.name === 'Poker' && input.participants) {
      for (const p of input.participants) {
        const [mp] = await db.insert(matchParticipants).values({ matchId: match.id, userId: p.userId, isWinner: p.isWinner || false }).returning()
        if (p.stats) {
          await db.insert(pokerLedgers).values({ matchId: match.id, matchParticipantId: mp.id, chipsIn: p.stats.chips_in || 0, chipsOut: p.stats.chips_out || 0 })
        }
      }
    } else if (game.name === 'Cricket') {`;

const newParticipantLogic = `    // Process all initial participants
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
    
    if (game.name === 'Cricket') {`;

code = code.replace(oldParticipantLogic, newParticipantLogic);

fs.writeFileSync(path, code);
console.log("Patched lib/actions/matches.ts");
