'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db, events, rsvps, polls, pollOptions, pollVotes, users, expenses, debts, matchParticipants } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

const tickerize = (title: string) =>
  '$' + title.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24)

const parseStartsAt = (t?: string) => {
  if (!t) return null;
  return t.includes('T') && !t.includes('Z') && !t.includes('+') ? new Date(`${t}+05:30`) : new Date(t);
}

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
      startsAt: parseStartsAt(input.startsAt),
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
          startsAt: parseStartsAt(input.startsAt),
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
      startsAt: parseStartsAt(input.startsAt),
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
      throw new Error("Margin limit reached: Can't invest further, already diversified in 3 watched positions.")
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
  const startsAtStr = event.startsAt ? new Date(event.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'
  
  const pendingDebts = await db.query.debts.findMany({
    where: and(or(eq(debts.fromUser, event.createdBy), eq(debts.toUser, event.createdBy)), eq(debts.status, 'pending'))
  });
  
  let netBalance = 0;
  for (const d of pendingDebts) {
    if (d.fromUser === event.createdBy) netBalance -= d.amount; // owes money
    if (d.toUser === event.createdBy) netBalance += d.amount; // is owed money
  }

  const gamesPlayed = await db.query.matchParticipants.findMany({
    where: eq(matchParticipants.userId, event.createdBy)
  });
  const gamesLost = gamesPlayed.filter(g => !g.isWinner).length;
  const gamesWon = gamesPlayed.filter(g => g.isWinner).length;
  
  const creatorStats = [];
  if (netBalance < -0.01) creatorStats.push(`Is currently in net debt for ₹${Math.abs(netBalance).toFixed(2)}.`);
  else if (netBalance > 0.01) creatorStats.push(`Has a positive net balance of ₹${netBalance.toFixed(2)} (others owe them money).`);
  
  if (gamesPlayed.length > 0) creatorStats.push(`Gaming record: ${gamesWon} wins, ${gamesLost} losses.`);
  const roastContext = creatorStats.length ? `\nContext to ruthlessly roast the creator: ${creatorStats.join(' ')} (e.g. if giving a treat but in debt, roast them hard. if giving a treat and others owe them money, mention their wealth. if losing games frequently, roast them).` : '';

  const prompt = `You are the sleek, cybernetic AI terminal of the Wing. Generate a cool, witty push notification to alert members about an upcoming ${typeStr}.
Event Title: ${event.title}
Start Time: ${startsAtStr}
Location: ${event.location === 'other' ? (event.locationCustom || 'Unknown') : event.location}
Created by: @${event.creator?.username}
Going LONG: ${longs}${roastContext}

Rules:
- Format strictly as JSON with 'title' and 'body'.
- Use clean Title Case for the title (max 40 chars).
- The 'body' MUST be formatted EXACTLY with these 4 lines using \n for line breaks:
Line 1: A short, savage hacker-themed intro (e.g. "Terminal activated.") that incorporates the roast if applicable.
Line 2: Location: [insert location]
Line 3: Time: [insert Start Time]
Line 4: Notes: [savage comment about the event or creator]
- DO NOT hallucinate any times or places.`

  try {
    const aiRes = await queryMistral([{ role: 'user', content: prompt }], user.id, undefined, 'mistral-medium-latest')
    const jsonStr = aiRes.content.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)
    
    const { broadcastToWing } = await import('./push')
    const broadcastResult = await broadcastToWing(parsed.title, parsed.body, '/hub', '/push-icon.png?v=2', '/push-badge.png?v=2')
    
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
    const fallbackTitle = `🚨 MARGIN CALL: ${event.category || typeStr}`
    const fallbackBody = `@${event.creator.username} scheduled ${event.title}`
    const broadcastResult = await broadcastToWing(fallbackTitle, fallbackBody, '/hub', '/push-icon.png?v=2', '/push-badge.png?v=2')
    
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
