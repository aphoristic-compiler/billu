import { db } from '../lib/db/index'
import { sql } from 'drizzle-orm'

async function run() {
  await db.execute(sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;`)
  console.log('Successfully added is_anonymous to polls')
  process.exit(0)
}

run()
