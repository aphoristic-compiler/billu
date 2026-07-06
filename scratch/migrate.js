require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

async function run() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    await sql`ALTER TABLE badminton_sets ADD COLUMN IF NOT EXISTS team_1_p2_id uuid REFERENCES match_participants(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE badminton_sets ADD COLUMN IF NOT EXISTS team_2_p2_id uuid REFERENCES match_participants(id) ON DELETE CASCADE`;
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sql.end();
  }
}
run();
