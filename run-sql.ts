import { db } from './lib/db/index.ts';
async function run() {
  try {
    await db.execute(`ALTER TYPE event_category ADD VALUE 'meal'`);
    await db.execute(`ALTER TYPE event_category ADD VALUE 'event'`);
    console.log('added');
  } catch (e: any) {
    console.error(e);
  }
  process.exit(0);
}
run();
