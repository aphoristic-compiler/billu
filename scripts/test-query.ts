import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' });

import { eq, isNull, desc, and } from 'drizzle-orm'
import { db, events } from '@/lib/db'

async function main() {
  try {
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
    });
    console.log("Success!", topLevel.length);
  } catch (e) {
    console.error(e);
  }
}
main();
