import { db, users, debts } from "@/lib/db";
import { eq } from "drizzle-orm";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("Users:");
  console.log(allUsers.map(u => ({ id: u.id, username: u.username })));

  const allDebts = await db.query.debts.findMany({
    with: { debtor: true, creditor: true }
  });
  console.log("\nDebts:");
  console.log(allDebts.map(d => ({
    id: d.id,
    from: d.debtor?.username,
    to: d.creditor?.username,
    amount: d.amount,
    status: d.status
  })));
  
  process.exit(0);
}

main().catch(console.error);
