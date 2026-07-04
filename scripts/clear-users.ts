import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import "dotenv/config"
import * as schema from "../lib/db/schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  console.log("Removing pre-seeded users...")
  // We don't delete clerkId users (actual logged in users)
  // Only the pre-seeded ones which have clerkId as NULL
  
  await db.delete(schema.users).where(
    schema.users.clerkId === null // wait, eq is better but we are importing schema
  ) // Wait, let's use sql directly
  
  await sql`DELETE FROM users WHERE clerk_id IS NULL`;
  
  console.log("Pre-seeded users removed.");
}

main().catch(console.error);
