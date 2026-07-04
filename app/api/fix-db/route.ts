import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getCurrentDbUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentDbUser()
    if (!user || user.username !== 'green_vitriol_') {
      return new NextResponse('Unauthorized - Only green_vitriol_ can access this route', { status: 401 })
    }
    // Attempt to manually apply the missing columns in production
    await db.execute(sql`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false NOT NULL;
    `)
    
    // Also drop the "notes" column from events just in case it's still there (as per schema update)
    await db.execute(sql`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "notes";
    `)
    
    // Verify it works
    const count = await db.execute(sql`SELECT count(*) FROM "events"`)
    
    return NextResponse.json({ success: true, message: 'Database schema forced sync completed!', rows: count })
  } catch (err: any) {
    console.error('Failed to fix database:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
