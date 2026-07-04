'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, events, rsvps, polls, pollOptions, pollVotes, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

const tickerize = (title: string) =>
  '$' + title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)

export async function createEvent(input: {
  title: string
  description?: string
  category: 'treat' | 'dinner' | 'game' | 'outing' | 'trip'
  location:
    | 'rehdi'
    | 'c_not'
    | 'fm'
    | '301'
    | 'looters'
    | 'dominos'
    | 'outside_campus'
    | 'other'
  locationCustom?: string
  startsAt?: string
  whatsappBlasted?: boolean
  microEvents?: { title: string; location: string; locationCustom?: string }[]
}) {
  const user = await requireDbUser()

  const [event] = await db
    .insert(events)
    .values({
      createdBy: user.id,
      title: input.title,
      description: input.description || null,
      category: input.category,
      location: input.location,
      locationCustom: input.locationCustom || null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      whatsappBlasted: !!input.whatsappBlasted,
    })
    .returning()

  if (input.microEvents?.length && (input.category === 'outing' || input.category === 'trip')) {
    await db.insert(events).values(
      input.microEvents
        .filter((m) => m.title.trim())
        .map((m) => ({
          parentEventId: event.id,
          createdBy: user.id,
          title: m.title,
          category: 'treat' as const,
          location: (m.location || 'other') as typeof input.location,
          locationCustom: m.locationCustom || null,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
        })),
    )
  }

  await logActivity(
    user.id,
    'event_created',
    `[TICK] ${tickerize(input.title)} deployed by @${user.username}`,
  )

  revalidatePath('/hub')
  revalidatePath('/hub/events')
  return event
}

export async function deleteEvent(eventId: string) {
  const user = await requireDbUser()
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return
  if (event.createdBy !== user.id) throw new Error('Only the creator can liquidate this position.')
  // delete micro-events first
  await db.delete(events).where(eq(events.parentEventId, eventId))
  await db.delete(events).where(eq(events.id, eventId))
  await logActivity(user.id, 'event_deleted', `[CLOSE] ${tickerize(event.title)} position closed by @${user.username}`)
  revalidatePath('/hub')
  revalidatePath('/hub/events')
}

export async function setRsvp(eventId: string, status: 'long' | 'short' | 'hedge') {
  const user = await requireDbUser()

  await db
    .insert(rsvps)
    .values({ eventId, userId: user.id, status })
    .onConflictDoUpdate({
      target: [rsvps.eventId, rsvps.userId],
      set: { status },
    })

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  const verb = status.toUpperCase()
  await logActivity(
    user.id,
    'rsvp',
    `[${verb}] @${user.username} ${status === 'short' ? 'exited' : 'entered'} ${tickerize(event?.title ?? 'EVENT')}`,
  )

  revalidatePath('/hub')
  revalidatePath('/hub/events')
}

export async function createPoll(eventId: string, question: string, options: string[]) {
  const user = await requireDbUser()
  const [poll] = await db
    .insert(polls)
    .values({ eventId, question, createdBy: user.id })
    .returning()

  await db.insert(pollOptions).values(
    options
      .filter((o) => o.trim())
      .map((label, i) => ({ pollId: poll.id, label, sortOrder: i })),
  )

  await logActivity(user.id, 'poll_created', `[VOTE] market survey opened by @${user.username}`)
  revalidatePath('/hub/events')
  return poll
}

export async function votePoll(pollId: string, pollOptionId: string) {
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
  revalidatePath('/hub/events')
}

export async function getEventsWithDetails() {
  const topLevel = await db.query.events.findMany({
    where: and(isNull(events.parentEventId), eq(events.isArchived, false)),
    orderBy: [desc(events.createdAt)],
    with: {
      creator: true,
      rsvps: { with: { user: true } },
      microEvents: {
        with: { expenses: { with: { payer: true, splits: { with: { user: true } } } } }
      },
      expenses: {
        with: { payer: true, splits: { with: { user: true } } }
      },
      polls: {
        with: {
          options: { with: { votes: { with: { user: true } } } },
        },
      },
    },
  })
  return topLevel
}

export async function getMembers() {
  return db.select().from(users).orderBy(users.username)
}

export async function addMicroEvent(parentEventId: string, input: { title: string; location: string; locationCustom?: string; startsAt?: string }) {
  const user = await requireDbUser()
  const [m] = await db.insert(events).values({
    parentEventId,
    createdBy: user.id,
    title: input.title,
    category: 'treat' as const,
    location: (input.location || 'other') as any,
    locationCustom: input.locationCustom || null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
  }).returning()
  
  await logActivity(user.id, 'event_created', `[TICK] sub_position ${tickerize(input.title)} deployed by @${user.username}`)
  revalidatePath('/hub')
  revalidatePath('/hub/events')
  return m
}

export async function archiveEvent(eventId: string) {
  const user = await requireDbUser()
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return
  if (event.createdBy !== user.id) throw new Error('Only the creator can vault this position.')
  
  await db.update(events).set({ isArchived: true }).where(eq(events.id, eventId))
  // Also archive microevents
  await db.update(events).set({ isArchived: true }).where(eq(events.parentEventId, eventId))
  
  await logActivity(user.id, 'event_archived', `[VAULT] ${tickerize(event.title)} vaulted by @${user.username}`)
  revalidatePath('/hub')
  revalidatePath('/hub/events')
}

export async function getArchivedEvents() {
  await requireDbUser()
  return await db.query.events.findMany({
    where: and(eq(events.isArchived, true), isNull(events.parentEventId)),
    orderBy: [desc(events.createdAt)],
    with: {
      creator: true,
      rsvps: {
        with: { user: true }
      },
      expenses: {
        with: { splits: true, payer: true }
      },
      vaultMedia: {
        with: { uploader: true }
      },
      microEvents: {
        with: {
          creator: true,
          rsvps: {
            with: { user: true }
          },
          expenses: {
            with: { splits: true, payer: true }
          },
          vaultMedia: {
            with: { uploader: true }
          },
        }
      }
    }
  })
}
