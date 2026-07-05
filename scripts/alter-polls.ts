import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL or POSTGRES_URL found. Skipping DB migration.");
    return;
  }
  const sql = postgres(dbUrl, { prepare: false })
  try {
    await sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;`
    await sql`ALTER TABLE polls ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;`
    await sql`ALTER TABLE polls ALTER COLUMN event_id DROP NOT NULL;`
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;`
    console.log("Success: Added all columns");
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log("Column already exists");
    } else {
      console.error("Migration error:", e);
    }
  } finally {
    await sql.end()
  }
}
main();
