const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL);
sql`TRUNCATE TABLE daily_banners`.then(() => {
  console.log('Truncated daily_banners');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
