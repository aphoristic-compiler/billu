import { config } from 'dotenv'
config({ path: '.env.local' })
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })

async function main() {
  try {
    // 1. Create Enum
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cricket_role') THEN
          CREATE TYPE cricket_role AS ENUM ('batsman', 'bowler', 'batting_all_rounder', 'bowling_all_rounder', 'wicket_keeper');
        END IF;
      END$$;
    `;
    
    // 2. Add column to users
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS cricket_role cricket_role`;
    
    // 3. Add column to matches
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false`;

    console.log('Success: Added cricket_role and is_archived columns');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await sql.end();
  }
}

main();
