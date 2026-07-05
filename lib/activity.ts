import { db, activityLog, systemLeaks } from '@/lib/db'

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

export async function logSystemLeak(params: { memberName?: string; body: string }) {
  try {
    await db.insert(systemLeaks).values({
      category: 'misc',
      title: 'AI Intercepted Intel',
      memberName: params.memberName || null,
      body: params.body,
      rarity: 'uncommon',
    })
  } catch (e) {
    console.error('[v0] Failed to write system leak:', e)
  }
}
