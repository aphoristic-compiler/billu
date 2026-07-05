'use server'

import { revalidatePath } from 'next/cache'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { db, polls, pollOptions, pollVotes } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'

export async function getStandalonePolls() {
  const allPolls = await db.query.polls.findMany({
    where: and(isNull(polls.eventId), eq(polls.isArchived, false)),
    orderBy: [desc(polls.createdAt)],
    with: {
      creator: true,
      options: {
        orderBy: [pollOptions.sortOrder],
        with: {
          votes: {
            with: { user: true },
          },
        },
      },
    },
  })

  return allPolls.map(p => ({
    ...p,
    creator: p.creator ? { id: p.creator.id, username: p.creator.username, displayName: p.creator.displayName } : null,
    options: p.options.map(o => ({
      ...o,
      votes: o.votes.map(v => ({
        ...v,
        user: v.user ? { id: v.user.id, username: v.user.username, displayName: v.user.displayName } : null
      }))
    }))
  }))
}

export async function createStandalonePoll(question: string, options: string[]) {
  const user = await requireDbUser()
  if (!question.trim()) throw new Error('Question required')
  if (options.length < 2) throw new Error('At least 2 options required')

  const validOptions = options.map(o => o.trim()).filter(Boolean)
  if (validOptions.length < 2) throw new Error('At least 2 valid options required')

  const [poll] = await db.insert(polls).values({
    question,
    createdBy: user.id,
  }).returning()

  await db.insert(pollOptions).values(
    validOptions.map((label, idx) => ({
      pollId: poll.id,
      label,
      sortOrder: idx,
    }))
  )

  revalidatePath('/hub/surveys')
  revalidatePath('/hub')
}

export async function voteStandalonePoll(pollId: string, pollOptionId: string) {
  const user = await requireDbUser()

  // one vote per poll per user: remove any prior vote in this poll
  const optionsInPoll = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))

  for (const opt of optionsInPoll) {
    await db
      .delete(pollVotes)
      .where(and(eq(pollVotes.pollOptionId, opt.id), eq(pollVotes.userId, user.id)))
  }

  await db.insert(pollVotes).values({ pollOptionId, userId: user.id }).onConflictDoNothing()
  
  revalidatePath('/hub/surveys')
  revalidatePath('/hub')
}

export async function togglePollPin(pollId: string) {
  const user = await requireDbUser()
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId))
  if (!poll) throw new Error('Poll not found')
  if (poll.createdBy !== user.id) throw new Error('Only the creator can pin this poll')

  if (!poll.isPinned) {
    // Check combined limit of 3
    const eventsRes = await db.execute<{count: string}>(db.dialect.sql`SELECT count(*) FROM events WHERE is_pinned = true`)
    const pollsRes = await db.execute<{count: string}>(db.dialect.sql`SELECT count(*) FROM polls WHERE is_pinned = true`)
    const totalCount = Number(eventsRes[0].count) + Number(pollsRes[0].count)
    if (totalCount >= 3) {
      throw new Error('Watchlist is full (max 3 assets). Unwatch an asset first.')
    }
  }

  await db.update(polls).set({ isPinned: !poll.isPinned }).where(eq(polls.id, pollId))
  revalidatePath('/hub/surveys')
  revalidatePath('/hub')
}

export async function deletePoll(pollId: string) {
  const user = await requireDbUser()
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
  
  if (!poll) throw new Error('Poll not found')
  if (poll.createdBy !== user.id) throw new Error('Only the creator can delete this poll')
  
  if (poll.isArchived) {
    throw new Error('Vaulted polls are memorialized and cannot be deleted.')
  }

  // Deleting the poll will cascade delete poll_options and poll_votes due to schema FKs
  await db.delete(polls).where(eq(polls.id, pollId))
  
  revalidatePath('/hub/surveys')
  revalidatePath('/hub')
}

export async function archivePoll(pollId: string) {
  const user = await requireDbUser()
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
  
  if (!poll) throw new Error('Poll not found')
  if (poll.createdBy !== user.id) throw new Error('Only the creator can vault this poll')

  await db.update(polls).set({ isArchived: true }).where(eq(polls.id, pollId))
  
  revalidatePath('/hub/surveys')
  revalidatePath('/hub')
}

export async function editPoll(pollId: string, question: string, options: string[]) {
  const user = await requireDbUser()
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1)
  
  if (!poll) throw new Error('Poll not found')
  if (poll.createdBy !== user.id) throw new Error('Only the creator can edit this poll')

  if (!question.trim()) throw new Error('Question required')
  const validOptions = options.map(o => o.trim()).filter(Boolean)
  if (validOptions.length < 2) throw new Error('At least 2 valid options required')

  // Update question
  await db.update(polls).set({ question }).where(eq(polls.id, pollId))

  // For options, we will wipe existing options and recreate them.
  // Note: This wipes votes as well. 
  await db.delete(pollOptions).where(eq(pollOptions.pollId, pollId))
  
  await db.insert(pollOptions).values(
    validOptions.map((label, idx) => ({
      pollId: poll.id,
      label,
      sortOrder: idx,
    }))
  )

  revalidatePath('/hub/surveys')
  revalidatePath('/hub/events')
  revalidatePath('/hub')
}
