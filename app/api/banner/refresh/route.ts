import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDailyBanner } from '@/lib/actions/banner'
import { getCurrentDbUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentDbUser()
    if (!user || user.username !== 'aaryn') {
      return new NextResponse('Unauthorized - Only Aaryn can access this route', { status: 401 })
    }
    // 1. Delete all cached banners
    await db.execute(sql`TRUNCATE TABLE "daily_banners" CASCADE;`)
    
    // 2. Force generation of a new banner right now
    const newBannerText = await getDailyBanner()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Banner refreshed successfully',
      banner: newBannerText 
    })
  } catch (err: any) {
    console.error('Failed to refresh banner:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
