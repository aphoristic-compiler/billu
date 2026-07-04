import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  console.log("Adding is_archived column to events...");
  try {
    await sql`ALTER TABLE "events" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL`;
    console.log("Successfully added is_archived to events!");
  } catch(e) {
    console.log("It might already exist:", e);
  }
  process.exit(0);
}

main().catch(console.error);
