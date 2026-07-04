import { db, games } from './lib/db';
import { eq } from 'drizzle-orm';

async function fixPoker() {
  await db.update(games)
    .set({ statSchema: { chips_in: 'number', chips_out: 'number' } })
    .where(eq(games.name, 'Poker'));
  console.log('Fixed Poker');
}

fixPoker();
