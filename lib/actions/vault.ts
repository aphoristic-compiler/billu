'use server'

import { revalidatePath } from 'next/cache'
import { desc } from 'drizzle-orm'
import { db, quotes, vaultMedia, events } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function addQuote(text: string) {
  const user = await requireDbUser()
  await db.insert(quotes).values({
    addedBy: user.id,
    quote: text,
    attributedTo: user.displayName,
    context: null,
  })
  await logActivity(
    user.id,
    'quote_added',
    `[INTERCEPT] new transmission logged by @${user.username}`,
  )
  revalidatePath('/hub')
  revalidatePath('/hub/vault')
}

export async function deleteQuote(id: string) {
  const user = await requireDbUser()
  await db.delete(quotes).where((q) => q.id === id && q.addedBy === user.id)
  await logActivity(
    user.id,
    'quote_deleted',
    `[REDACTED] transmission purged by @${user.username}`,
  )
  revalidatePath('/hub/vault')
}

export async function getQuotes() {
  return await db.query.quotes.findMany({ orderBy: [desc(quotes.createdAt)] })
}

export async function getVaultMedia() {
  return await db.query.vaultMedia.findMany({ orderBy: [desc(vaultMedia.createdAt)] })
}

export async function saveVaultMedia(input: {
  cloudinaryUrl: string
  cloudinaryPublicId: string
  mediaType: 'image' | 'video' | 'document'
  caption?: string
  tags?: string[]
  eventId?: string
}) {
  const user = await requireDbUser()
  await db.insert(vaultMedia).values({
    uploadedBy: user.id,
    cloudinaryUrl: input.cloudinaryUrl,
    cloudinaryPublicId: input.cloudinaryPublicId,
    mediaType: input.mediaType,
    caption: input.caption || null,
    tags: input.tags ?? [],
    eventId: input.eventId || null,
  })
  await logActivity(
    user.id,
    'media_uploaded',
    `[ARCHIVE] evidence secured by @${user.username}${input.caption ? ` — ${input.caption}` : ''}`,
  )
  revalidatePath('/hub/vault')
}

export async function getVaultData() {
  const [allQuotes, allMedia, allEvents] = await Promise.all([
    db.query.quotes.findMany({ orderBy: [desc(quotes.createdAt)], with: { author: true } }),
    db.query.vaultMedia.findMany({
      orderBy: [desc(vaultMedia.createdAt)],
      with: { uploader: true },
    }),
    db.select().from(events).orderBy(desc(events.createdAt)),
  ])
  return { quotes: allQuotes, media: allMedia, events: allEvents }
}
