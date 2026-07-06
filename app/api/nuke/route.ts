import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getCurrentDbUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentDbUser()
    if (!user || (user.username !== 'green_vitriol' && user.username !== 'green_vitriol_')) {
      return new NextResponse('Unauthorized - Only green_vitriol can access this route', { status: 401 })
    }
    // 1. Delete all Clerk users
    const client = await clerkClient()
    const clerkUsers = await client.users.getUserList()
    for (const u of clerkUsers.data) {
      await client.users.deleteUser(u.id)
    }

    // 2. Truncate all user-generated data tables
    // We use CASCADE so we don't have to worry about foreign key constraint order,
    // though listing them all here is safe.
    await db.execute(sql`
      TRUNCATE TABLE 
        "users", 
        "events", 
        "rsvps", 
        "polls", 
        "poll_options", 
        "poll_votes", 
        "matches", 
        "match_participants", 
        "expenses", 
        "expense_splits", 
        "debts", 
        "vault_media", 
        "daily_banners", 
        "quotes", 
        "active_arcade_game", 
        "arcade_leaderboard", 
        "system_leaks", 
        "activity_log",
        "push_subscriptions"
      CASCADE;
    `)
    
    return NextResponse.json({ success: true, message: 'Database wiped clean successfully. All user accounts and events are gone.' })
  } catch (err: any) {
    console.error('Failed to nuke database:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
