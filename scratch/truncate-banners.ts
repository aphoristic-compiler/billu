import { db } from './lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`TRUNCATE TABLE daily_banners;`);
    console.log('daily_banners truncated');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
