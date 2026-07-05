'use server'

import { eq, notInArray } from 'drizzle-orm'
import { db, systemLeaks, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { queryMistral } from '@/lib/mistral'

const RARITY_WEIGHTS = { common: 40, uncommon: 30, rare: 20, legendary: 10 } as const

export async function getRandomLeak(excludeIds: string[] = []) {
  let pool = await db
    .select()
    .from(systemLeaks)
    .where(excludeIds.length ? notInArray(systemLeaks.id, excludeIds) : undefined)

  if (!pool.length) {
    pool = await db.select().from(systemLeaks)
  }
  if (!pool.length) return null

  const totalWeight = pool.reduce((s, l) => s + RARITY_WEIGHTS[l.rarity], 0)
  let roll = Math.random() * totalWeight
  for (const leak of pool) {
    roll -= RARITY_WEIGHTS[leak.rarity]
    if (roll <= 0) return leak
  }
  return pool[pool.length - 1]
}

export async function getLeakForMember(name: string) {
  const pool = await db.select().from(systemLeaks)
  const matches = pool.filter(
    (l) => l.memberName && l.memberName.toLowerCase().includes(name.toLowerCase()),
  )
  if (!matches.length) return null
  return matches[Math.floor(Math.random() * matches.length)]
}

export async function markBootSeen() {
  const user = await requireDbUser()
  if (!user.bootSequenceSeen) {
    await db.update(users).set({ bootSequenceSeen: true }).where(eq(users.id, user.id))
  }
}

export async function addLore(memberName: string, text: string) {
  const user = await requireDbUser()
  
  let expandedLore = text;
  try {
    const prompt = `You are a rogue AI terminal maintaining a database of "anomalies" about a group of friends. 
A user has submitted the following raw, incomplete intel about a member named "${memberName}": 
"${text}"

Expand this into a short, fully-fledged "Anomaly Report" (max 2-3 sentences). Make it sound like a leaked, highly-classified, slightly sarcastic terminal log. Do not use markdown formatting.
Output ONLY the expanded anomaly text, nothing else.`;

    const messages = [{ role: 'user', content: prompt }];
    const responseMsg = await queryMistral(messages, user.id);
    if (responseMsg && responseMsg.content) {
      expandedLore = responseMsg.content.trim();
    }
  } catch (error) {
    console.error("Failed to expand lore via AI", error);
  }

  await db.insert(systemLeaks).values({
    memberName: memberName,
    body: expandedLore,
    category: 'member',
    title: 'AI Enhanced Intel',
    rarity: 'uncommon'
  })
}
