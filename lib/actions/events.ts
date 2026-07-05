'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db, events, rsvps, polls, pollOptions, pollVotes, users, expenses, debts } from '@/lib/db'
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

export async function updateEvent(eventId: string, input: {
  title: string
  description?: string
  category: 'treat' | 'dinner' | 'game' | 'outing' | 'trip'
  location: string
  locationCustom?: string
  startsAt?: string
}) {
  const user = await requireDbUser()
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  
  if (!event) throw new Error('Event not found')
  if (event.createdBy !== user.id) throw new Error('Only the creator can edit this event.')

  const [updated] = await db.update(events)
    .set({
      title: input.title,
      description: input.description || null,
      category: input.category as any,
      location: input.location as any,
      locationCustom: input.locationCustom || null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
    })
    .where(eq(events.id, eventId))
    .returning()

  await logActivity(
    user.id,
    'event_updated',
    `[EDIT] ${tickerize(input.title)} terms revised by @${user.username}`
  )

  revalidatePath('/hub')
  revalidatePath('/hub/events')
  return updated
}

export async function deleteEvent(eventId: string) {
  const user = await requireDbUser()
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return
  if (event.createdBy !== user.id) throw new Error('Only the creator can liquidate this position.')
  
  if (event.isArchived) {
    throw new Error('Vaulted positions are memorialized and cannot be liquidated.')
  }

  // 1. Delete associated expenses and debts (Cascade)
  const eventExpenses = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.eventId, eventId))
  const expenseIds = eventExpenses.map((e: any) => e.id)
  
  if (expenseIds.length > 0) {
    await db.delete(debts).where(inArray(debts.expenseId, expenseIds))
    await db.delete(expenses).where(inArray(expenses.id, expenseIds))
  }

  // 2. delete micro-events first
  await db.delete(events).where(eq(events.parentEventId, eventId))
  
  // 3. delete the event itself
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

export async function createPoll(eventId: string, question: string, options: string[], isAnonymous: boolean = false) {
  const user = await requireDbUser()
  const [poll] = await db
    .insert(polls)
    .values({ eventId, question, createdBy: user.id, isAnonymous })
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
  
  // Safely map to avoid Drizzle circular references crashing Server Components
  const safeEvents = topLevel.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    location: e.location,
    locationCustom: e.locationCustom,
    startsAt: e.startsAt ? e.startsAt.toISOString() : null,
    isLive: e.isLive,
    isPinned: e.isPinned,
    whatsappBlasted: e.whatsappBlasted,
    createdBy: e.createdBy,
    creator: e.creator ? { id: e.creator.id, username: e.creator.username, displayName: e.creator.displayName } : null,
    rsvps: (e.rsvps || []).map((r) => ({
      id: r.id,
      status: r.status,
      userId: r.userId,
      user: r.user ? { id: r.user.id, username: r.user.username, displayName: r.user.displayName } : null
    })),
    microEvents: (e.microEvents || []).map((m) => ({
      id: m.id,
      title: m.title,
      location: m.location,
      locationCustom: m.locationCustom,
      expenses: m.expenses || [],
    })),
    polls: (e.polls || []).map((p) => ({
      id: p.id,
      question: p.question,
      options: (p.options || []).map((o) => ({
        id: o.id,
        label: o.label,
        votes: (o.votes || []).map((v) => ({
          id: v.id,
          userId: v.userId,
          user: v.user ? { id: v.user.id, username: v.user.username, displayName: v.user.displayName } : null
        }))
      }))
    })),
    expenses: e.expenses || [],
  }))
  
  return safeEvents as any
}

export async function getTripDesk(eventId: string) {
  const [parentEvent, microEvents] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        creator: true,
        rsvps: { with: { user: true } },
        expenses: { with: { payer: true, splits: { with: { user: true } } } },
        polls: { with: { options: { with: { votes: { with: { user: true } } } } } },
        vaultMedia: { with: { uploader: true } },
      },
    }),
    db.query.events.findMany({
      where: eq(events.parentEventId, eventId),
      orderBy: [desc(events.createdAt)],
      with: {
        creator: true,
        rsvps: { with: { user: true } },
        expenses: { with: { payer: true, splits: { with: { user: true } } } },
        polls: { with: { options: { with: { votes: { with: { user: true } } } } } },
        vaultMedia: { with: { uploader: true } },
      },
    })
  ])

  if (!parentEvent) return null

  const mapSafe = (e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    location: e.location,
    locationCustom: e.locationCustom,
    startsAt: e.startsAt ? e.startsAt.toISOString() : null,
    isLive: e.isLive,
    isPinned: e.isPinned,
    whatsappBlasted: e.whatsappBlasted,
    createdBy: e.createdBy,
    creator: e.creator ? { id: e.creator.id, username: e.creator.username, displayName: e.creator.displayName } : null,
    rsvps: (e.rsvps || []).map((r: any) => ({
      id: r.id,
      status: r.status,
      userId: r.userId,
      user: r.user ? { id: r.user.id, username: r.user.username, displayName: r.user.displayName } : null
    })),
    microEvents: [], // Keep signature compatible with EventCard
    polls: (e.polls || []).map((p: any) => ({
      id: p.id,
      question: p.question,
      options: (p.options || []).map((o: any) => ({
        id: o.id,
        label: o.label,
        votes: (o.votes || []).map((v: any) => ({
          id: v.id,
          userId: v.userId,
          user: v.user ? { id: v.user.id, username: v.user.username, displayName: v.user.displayName } : null
        }))
      }))
    })),
    expenses: e.expenses || [],
    vaultMedia: (e.vaultMedia || []).map((v: any) => ({
      id: v.id,
      cloudinaryUrl: v.cloudinaryUrl,
      mediaType: v.mediaType,
      caption: v.caption,
      uploader: v.uploader ? { id: v.uploader.id, username: v.uploader.username, displayName: v.uploader.displayName } : null
    }))
  })

  return {
    parent: mapSafe(parentEvent),
    children: microEvents.map(mapSafe)
  }
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
  // Also archive attached polls
  await db.update(polls).set({ isArchived: true }).where(eq(polls.eventId, eventId))
  
  await logActivity(user.id, 'event_archived', `[VAULT] ${tickerize(event.title)} vaulted by @${user.username}`)
  revalidatePath('/hub')
  revalidatePath('/hub/events')
}

export async function toggleEventPin(eventId: string) {
  const user = await requireDbUser()
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return

  if (!event.isPinned) {
    const pinnedEvents = await db.select().from(events).where(eq(events.isPinned, true))
    if (pinnedEvents.length >= 3) {
      throw new Error('Maximum of 3 positions can be pinned to the watchlist at a time.')
    }
  }

  await db.update(events).set({ isPinned: !event.isPinned }).where(eq(events.id, eventId))
  
  await logActivity(user.id, 'event_updated', `[WATCHLIST] ${tickerize(event.title)} ${!event.isPinned ? 'added to' : 'removed from'} watchlist by @${user.username}`)
  revalidatePath('/hub')
  revalidatePath('/hub/events')
}

export async function getArchivedEvents() {
  await requireDbUser()
  const topLevel = await db.query.events.findMany({
    where: and(eq(events.isArchived, true), isNull(events.parentEventId)),
    orderBy: [desc(events.createdAt)],
    with: {
      creator: true,
      rsvps: { with: { user: true } },
      expenses: { with: { payer: true, splits: { with: { user: true } } } },
      microEvents: {
        with: { expenses: { with: { payer: true, splits: { with: { user: true } } } } }
      },
      vaultMedia: {
        with: { uploader: true }
      },
    },
  })

  // Safe mapping for vault
  const safeEvents = topLevel.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category,
    location: e.location,
    locationCustom: e.locationCustom,
    startsAt: e.startsAt ? e.startsAt.toISOString() : null,
    isLive: e.isLive,
    whatsappBlasted: e.whatsappBlasted,
    createdBy: e.createdBy,
    creator: e.creator ? { id: e.creator.id, username: e.creator.username, displayName: e.creator.displayName } : null,
    rsvps: (e.rsvps || []).map((r) => ({
      id: r.id,
      status: r.status,
      userId: r.userId,
      user: r.user ? { id: r.user.id, username: r.user.username, displayName: r.user.displayName } : null
    })),
    microEvents: (e.microEvents || []).map((m) => ({
      id: m.id,
      title: m.title,
      location: m.location,
      locationCustom: m.locationCustom,
      expenses: m.expenses || [],
    })),
    expenses: e.expenses || [],
    vaultMedia: (e.vaultMedia || []).map((v) => ({
      id: v.id,
      cloudinaryUrl: v.cloudinaryUrl,
      mediaType: v.mediaType,
      caption: v.caption,
      uploader: v.uploader ? { id: v.uploader.id, username: v.uploader.username, displayName: v.uploader.displayName } : null
    }))
  }))

  return safeEvents as any
}

export async function blastEventToWing(eventId: string) {
  const user = await requireDbUser()
  const { queryMistral } = await import('@/lib/mistral')

  const [event] = await db.query.events.findMany({
    where: eq(events.id, eventId),
    with: { rsvps: { with: { user: true } }, creator: true },
    limit: 1
  })

  if (!event) throw new Error('Event not found')

  const isMicro = event.parentEventId !== null
  const typeStr = isMicro ? 'microevent (sub-position)' : 'event/trip'
  
  const longs = event.rsvps?.filter((r: any) => r.status === 'long').map((r: any) => r.user?.username).join(', ') || 'None'
  
  const prompt = `You are the chaotic AI terminal of the Wing. Generate a savage push notification to blast out to all members about an upcoming ${typeStr}.
Title: ${event.title}
Created by: ${event.creator?.username}
Currently going LONG (attending): ${longs}
Format the response strictly as JSON with 'title' (max 40 chars) and 'body' (max 120 chars, savage and terminal-themed).`

  try {
    const aiRes = await queryMistral([{ role: 'user', content: prompt }], user.id)
    const jsonStr = aiRes.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    
    const { broadcastToWing } = await import('./push')
    const broadcastResult = await broadcastToWing(parsed.title, parsed.body)
    
    if (!broadcastResult.success) {
      throw new Error(broadcastResult.error || 'Push failed: Check VAPID keys on Vercel.')
    }

    await logActivity(user.id, 'event_blasted', `[BLAST] PUSH NOTIFICATION DISPATCHED: "${parsed.title} - ${parsed.body}"`)
    await db.update(events).set({ whatsappBlasted: true }).where(eq(events.id, eventId))
    
    revalidatePath('/hub')
    revalidatePath('/hub/events')
    
    return broadcastResult
  } catch (err: any) {
    console.error('Failed to generate blast notification:', err)
    
    // If it was a Web Push failure, throw it up
    if (err.message && err.message.includes('Push failed') || err.message.includes('VAPID')) {
      throw err;
    }

    // Fallback if Mistral fails, just use generic push
    const { broadcastToWing } = await import('./push')
    const genericTitle = `🚨 MARGIN CALL: ${event.category || event.type}`
    const genericBody = `@${event.creator?.username} scheduled ${event.title || event.name}`
    
    const broadcastResult = await broadcastToWing(genericTitle, genericBody)
    
    if (!broadcastResult.success) {
      throw new Error(broadcastResult.error || 'Push failed: Check VAPID keys on Vercel.')
    }

    await db.update(events).set({ whatsappBlasted: true }).where(eq(events.id, eventId))
    await logActivity(user.id, 'event_blasted', `[BLAST] PUSH NOTIFICATION DISPATCHED FOR: ${event.title}`)
    
    revalidatePath('/hub')
    revalidatePath('/hub/events')
    
    return broadcastResult
  }
}
