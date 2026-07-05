import postgres from "postgres"
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
  try {
    const res = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'polls' OR table_name = 'events';
    `
    console.log(res.map(r => r.column_name))
  } finally {
    await sql.end()
  }
}
main();
