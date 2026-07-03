import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { db, activityLog } from '@/lib/db'
import { getCurrentDbUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const entries = await db.query.activityLog.findMany({
    orderBy: [desc(activityLog.id)],
    limit: 50,
  })

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      type: e.type,
      text: (e.payload as { text?: string }).text ?? e.type,
      createdAt: e.createdAt,
    })),
  )
}
