import { db } from '../lib/db'
import { sql } from 'drizzle-orm'

async function migrate() {
  console.log('Running migrations...')
  try {
    await db.execute(sql`ALTER TABLE polls ALTER COLUMN event_id DROP NOT NULL;`)
    await db.execute(sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;`)
    console.log('Successfully ran polls migrations!')
    process.exit(0)
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  }
}

migrate()
