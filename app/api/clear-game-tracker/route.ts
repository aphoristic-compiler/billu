import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getCurrentDbUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentDbUser()
    if (!user || (user.username !== 'green_vitriol' && user.username !== 'green_vitriol_')) {
      return new NextResponse('Unauthorized - Only green_vitriol can access this route', { status: 401 })
    }

    // Truncate only game-tracker tables (preserving games list)
    await db.execute(sql`
      TRUNCATE TABLE 
        "matches", 
        "match_participants", 
        "cricket_matches", 
        "cricket_innings", 
        "cricket_batter_logs", 
        "cricket_bowler_logs", 
        "badminton_sets", 
        "card_rounds", 
        "card_player_hands", 
        "poker_ledgers",
        "match_rounds",
        "match_round_stats"
      CASCADE;
    `)
    
    return NextResponse.json({ success: true, message: 'Game tracker data cleared successfully. Game definitions, events, users, and financials remain untouched.' })
  } catch (err: any) {
    console.error('Failed to clear game tracker database:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
