import { db, activityLog } from '@/lib/db'

export async function logActivity(
  userId: string | null,
  type: string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  try {
    await db.insert(activityLog).values({
      userId,
      type,
      payload: { text, ...extra },
    })
  } catch (e) {
    console.error('[v0] Failed to write activity log:', e)
  }
}
