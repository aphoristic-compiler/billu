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
    await sql`ALTER TABLE active_arcade_game ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'generating';`
    await sql`ALTER TABLE active_arcade_game ADD COLUMN IF NOT EXISTS detailed_prompt TEXT;`
    await sql`ALTER TABLE active_arcade_game ALTER COLUMN generated_code DROP NOT NULL;`
    console.log("Success: Added status and detailed_prompt columns to active_arcade_game");
  } catch (e: any) {
    console.error("Migration error:", e);
  } finally {
    await sql.end()
  }
}
main();
