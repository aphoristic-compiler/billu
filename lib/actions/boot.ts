'use server'

import { eq, notInArray } from 'drizzle-orm'
import { db, systemLeaks, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'

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
  await requireDbUser()
  await db.insert(systemLeaks).values({
    memberName: memberName,
    body: text,
    category: 'member',
    title: 'User Submitted Intel',
    rarity: 'common'
  })
}
