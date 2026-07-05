import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  try {
    await sql`ALTER TABLE polls ADD COLUMN is_archived boolean NOT NULL DEFAULT false;`
    console.log("Success: Added is_archived to polls");
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      console.log("Column already exists");
    } else {
      console.error(e);
    }
  } finally {
    await sql.end()
  }
}
main();
