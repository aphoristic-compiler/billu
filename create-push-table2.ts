import postgres from "postgres";
require("dotenv").config({ path: ".env.local" });
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  await sql`
    CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "endpoint" text NOT NULL,
      "p256dh" varchar(255) NOT NULL,
      "auth" varchar(255) NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    );
  `;
  console.log("Table created");
  process.exit(0);
}
run();
