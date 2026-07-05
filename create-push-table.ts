import { db } from "./lib/db/index";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "endpoint" text NOT NULL,
      "p256dh" varchar(255) NOT NULL,
      "auth" varchar(255) NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
  `);
  console.log("Table created");
  process.exit(0);
}

run();
