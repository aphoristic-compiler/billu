import { auth, currentUser } from '@clerk/nextjs/server'
import { eq, isNull, and, like } from 'drizzle-orm'
import { db, users } from '@/lib/db'

/**
 * Returns the local DB user for the signed-in Clerk user.
 * On first sign-in: claims an unclaimed seeded placeholder member if the
 * username matches, otherwise creates a fresh member row.
 */
export async function getCurrentDbUser() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return null

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (existing.length) return existing[0]

  const cu = await currentUser()
  if (!cu) return null

  const baseUsername = (
    cu.username ||
    cu.emailAddresses[0]?.emailAddress.split('@')[0] ||
    `member_${clerkId.slice(-6)}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')

  // Try to claim an unclaimed seeded member with a matching username
  const unclaimed = await db
    .select()
    .from(users)
    .where(and(isNull(users.clerkId), eq(users.username, baseUsername)))
    .limit(1)

  if (unclaimed.length) {
    const [claimed] = await db
      .update(users)
      .set({
        clerkId,
        displayName: unclaimed[0].displayName,
        avatarUrl: cu.imageUrl ?? unclaimed[0].avatarUrl,
      })
      .where(eq(users.id, unclaimed[0].id))
      .returning()
    return claimed
  }

  // Claim the first unclaimed placeholder slot (member_XX)
  const placeholder = await db
    .select()
    .from(users)
    .where(and(isNull(users.clerkId), like(users.username, 'member\\_%')))
    .limit(1)

  const displayName =
    [cu.firstName, cu.lastName].filter(Boolean).join(' ') || baseUsername

  if (placeholder.length) {
    const [claimed] = await db
      .update(users)
      .set({
        clerkId,
        username: baseUsername,
        displayName,
        avatarUrl: cu.imageUrl,
      })
      .where(eq(users.id, placeholder[0].id))
      .returning()
    return claimed
  }

  // No slots left — create a fresh member
  const [created] = await db
    .insert(users)
    .values({
      clerkId,
      username: baseUsername,
      displayName,
      avatarUrl: cu.imageUrl,
    })
    .returning()

  return created
}

export async function requireDbUser() {
  const user = await getCurrentDbUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}
