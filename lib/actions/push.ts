"use server"

import { eq } from "drizzle-orm"
import { db } from "../db"
import { pushSubscriptions } from "../db/schema"
import webpush from "web-push"

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:wing@saturo.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function saveSubscription(userId: string, subscription: any) {
  try {
    // Check if subscription already exists for this endpoint
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1)

    if (existing.length > 0) {
      return { success: true }
    }

    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })

    return { success: true }
  } catch (error) {
    console.error("Error saving push subscription:", error)
    return { success: false, error: "Failed to save subscription" }
  }
}

export async function broadcastToWing(title: string, body: string, url: string = "/hub") {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, skipping broadcast")
    throw new Error("VAPID keys are missing in Vercel environment.")
  }

  try {
    const allSubs = await db.select().from(pushSubscriptions)
    const payload = JSON.stringify({ title, body, url })

    const promises = allSubs.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      }
      return webpush.sendNotification(pushSubscription, payload).catch((err) => {
        // If expired or invalid, we could delete it here
        if (err.statusCode === 410 || err.statusCode === 404) {
          return db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
        }
        console.error("Failed to send push to endpoint:", sub.endpoint, err)
        throw err;
      })
    })

    const results = await Promise.allSettled(promises)
    
    // Check if any requests actually threw an error that wasn't 404/410 (which are handled natively)
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0 && failures.length === promises.length) {
      throw new Error(`Push failed: All endpoints rejected. E.g. ${failures[0].reason?.message || failures[0].reason}`)
    }

    return { success: true, count: allSubs.length }
  } catch (error: any) {
    console.error("Error broadcasting push:", error)
    throw new Error(error.message || "Failed to broadcast push notification.")
  }
}

