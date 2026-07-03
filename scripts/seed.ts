import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import "dotenv/config"
import * as schema from "../lib/db/schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

const {
  users,
  games,
  events,
  rsvps,
  expenses,
  expenseSplits,
  debts,
  matches,
  matchParticipants,
  quotes,
  systemLeaks,
  activityLog,
} = schema

async function main() {
  console.log("[v0] Seeding Billu Wing...")

  // ─── Members: 6 canonical + 6 placeholders ──────────────────────────────
  const memberData = [
    { username: "lkg", displayName: "LKG" },
    { username: "hitesh", displayName: "Hitesh Tiwari" },
    { username: "shreyansh", displayName: "Shreyansh Mishra" },
    { username: "anshul", displayName: "Anshul" },
    { username: "anmol", displayName: "Anmol" },
    { username: "tushar", displayName: "Tushar" },
    { username: "member_07", displayName: "Member_07" },
    { username: "member_08", displayName: "Member_08" },
    { username: "member_09", displayName: "Member_09" },
    { username: "member_10", displayName: "Member_10" },
    { username: "member_11", displayName: "Member_11" },
    { username: "member_12", displayName: "Member_12" },
  ]

  const insertedUsers = await db
    .insert(users)
    .values(memberData)
    .onConflictDoNothing()
    .returning()

  const allUsers = insertedUsers.length
    ? insertedUsers
    : await db.select().from(users)

  const u = (username: string) =>
    allUsers.find((x) => x.username === username)!.id

  console.log(`[v0] ${allUsers.length} members ready`)

  // ─── Games ───────────────────────────────────────────────────────────────
  await db
    .insert(games)
    .values([
      {
        name: "Poker",
        icon: "🃏",
        minPlayers: 2,
        maxPlayers: 10,
        statSchema: { fields: [{ key: "buy_in", label: "Buy-in (₹)", type: "number" }, { key: "cash_out", label: "Cash-out (₹)", type: "number" }] },
      },
      {
        name: "Cricket",
        icon: "🏏",
        minPlayers: 4,
        maxPlayers: 12,
        statSchema: { fields: [{ key: "runs", label: "Runs", type: "number" }, { key: "wickets", label: "Wickets", type: "number" }] },
      },
      {
        name: "Badminton",
        icon: "🏸",
        minPlayers: 2,
        maxPlayers: 4,
        statSchema: { fields: [{ key: "points", label: "Points", type: "number" }] },
      },
      {
        name: "FIFA",
        icon: "⚽",
        minPlayers: 2,
        maxPlayers: 4,
        statSchema: { fields: [{ key: "goals", label: "Goals", type: "number" }] },
      },
      {
        name: "Chess",
        icon: "♟️",
        minPlayers: 2,
        maxPlayers: 2,
        statSchema: { fields: [{ key: "moves", label: "Moves", type: "number" }] },
      },
      {
        name: "Carrom",
        icon: "🎯",
        minPlayers: 2,
        maxPlayers: 4,
        statSchema: { fields: [{ key: "coins", label: "Coins pocketed", type: "number" }] },
      },
      {
        name: "UNO",
        icon: "🎴",
        minPlayers: 2,
        maxPlayers: 10,
        statSchema: { fields: [{ key: "cards_left", label: "Cards left", type: "number" }] },
      },
    ])
    .onConflictDoNothing()

  const allGames = await db.select().from(games)
  const g = (name: string) => allGames.find((x) => x.name === name)!.id
  console.log(`[v0] ${allGames.length} games ready`)

  // ─── Events ──────────────────────────────────────────────────────────────
  const now = new Date()
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000)

  const [pokerNight] = await db
    .insert(events)
    .values({
      createdBy: u("lkg"),
      title: "Poker Night: The Reckoning",
      description: "LKG claims he will finally win his money back. Statistically improbable.",
      category: "game",
      location: "301",
      startsAt: inDays(1),
      isLive: false,
    })
    .returning()

  const [mallOuting] = await db
    .insert(events)
    .values({
      createdBy: u("tushar"),
      title: "Mall Road Outing",
      description: "Quarterly touch-grass compliance audit.",
      category: "outing",
      location: "outside_campus",
      locationCustom: "Mall Road",
      startsAt: inDays(3),
    })
    .returning()

  // micro-events under the outing
  await db.insert(events).values([
    {
      parentEventId: mallOuting.id,
      createdBy: u("tushar"),
      title: "Momos Stop",
      category: "treat",
      location: "outside_campus",
      locationCustom: "Momo corner",
      startsAt: inDays(3),
    },
    {
      parentEventId: mallOuting.id,
      createdBy: u("hitesh"),
      title: "Arcade Raid",
      category: "game",
      location: "outside_campus",
      locationCustom: "Timezone",
      startsAt: inDays(3),
    },
  ])

  const [maggiRun] = await db
    .insert(events)
    .values({
      createdBy: u("hitesh"),
      title: "2AM Maggi Run",
      description: "Emergency rations. Attendance is not optional, it is survival.",
      category: "dinner",
      location: "rehdi",
      startsAt: inDays(0),
      isLive: true,
    })
    .returning()

  await db.insert(rsvps).values([
    { eventId: pokerNight.id, userId: u("lkg"), status: "long" },
    { eventId: pokerNight.id, userId: u("hitesh"), status: "long" },
    { eventId: pokerNight.id, userId: u("shreyansh"), status: "hedge" },
    { eventId: pokerNight.id, userId: u("tushar"), status: "short" },
    { eventId: maggiRun.id, userId: u("anshul"), status: "long" },
    { eventId: maggiRun.id, userId: u("anmol"), status: "long" },
    { eventId: maggiRun.id, userId: u("lkg"), status: "hedge" },
    { eventId: mallOuting.id, userId: u("tushar"), status: "long" },
    { eventId: mallOuting.id, userId: u("shreyansh"), status: "long" },
  ])
  console.log("[v0] Events + RSVPs seeded")

  // ─── Expense + splits + debts ────────────────────────────────────────────
  const [dominosExp] = await db
    .insert(expenses)
    .values({
      paidBy: u("hitesh"),
      title: "Dominos damage (4 pizzas)",
      totalAmount: 1240,
      tag: "food",
      notes: "LKG ate 40% and paid 0%. Classic.",
    })
    .returning()

  const splitAmt = 1240 / 4
  await db.insert(expenseSplits).values([
    { expenseId: dominosExp.id, userId: u("hitesh"), amount: splitAmt },
    { expenseId: dominosExp.id, userId: u("lkg"), amount: splitAmt },
    { expenseId: dominosExp.id, userId: u("shreyansh"), amount: splitAmt },
    { expenseId: dominosExp.id, userId: u("tushar"), amount: splitAmt },
  ])

  await db.insert(debts).values([
    { fromUser: u("lkg"), toUser: u("hitesh"), amount: splitAmt, expenseId: dominosExp.id },
    { fromUser: u("shreyansh"), toUser: u("hitesh"), amount: splitAmt, expenseId: dominosExp.id },
    { fromUser: u("tushar"), toUser: u("hitesh"), amount: splitAmt, expenseId: dominosExp.id },
    { fromUser: u("anshul"), toUser: u("lkg"), amount: 340 },
  ])
  console.log("[v0] Ledger seeded")

  // ─── Match: a poker game ─────────────────────────────────────────────────
  const [pokerMatch] = await db
    .insert(matches)
    .values({
      gameId: g("Poker"),
      createdBy: u("lkg"),
      notes: "The night LKG actually won. Historians dispute this record.",
      playedAt: new Date(now.getTime() - 2 * 86400000),
    })
    .returning()

  await db.insert(matchParticipants).values([
    { matchId: pokerMatch.id, userId: u("lkg"), stats: { buy_in: 500, cash_out: 1800 }, isWinner: true },
    { matchId: pokerMatch.id, userId: u("hitesh"), stats: { buy_in: 500, cash_out: 200 }, isWinner: false },
    { matchId: pokerMatch.id, userId: u("shreyansh"), stats: { buy_in: 500, cash_out: 350 }, isWinner: false },
    { matchId: pokerMatch.id, userId: u("tushar"), stats: { buy_in: 500, cash_out: 150 }, isWinner: false },
  ])
  console.log("[v0] Match seeded")

  // ─── Quotes ──────────────────────────────────────────────────────────────
  await db.insert(quotes).values([
    {
      addedBy: u("shreyansh"),
      quote: "Bro I'm not addicted to CG, CG is addicted to me.",
      attributedTo: "Shreyansh",
      context: "11:58 PM, two minutes before result declaration",
    },
    {
      addedBy: u("hitesh"),
      quote: "Excel can do everything GPT can. I have proof. It's in a spreadsheet.",
      attributedTo: "Hitesh",
      context: "AI/ML club meeting he was not invited to",
    },
    {
      addedBy: u("tushar"),
      quote: "I'm not short, the ceiling is just unnecessarily far away.",
      attributedTo: "Tushar",
      context: "Measured against the door frame, again",
    },
    {
      addedBy: u("lkg"),
      quote: "It's not about the ₹12. It's about the principle. Also give me the ₹12.",
      attributedTo: "LKG",
      context: "3AM during poker",
    },
  ])
  console.log("[v0] Quotes seeded")

  // ─── System leaks (lore) ─────────────────────────────────────────────────
  await db.insert(systemLeaks).values([
    // LKG
    { category: "member", memberName: "LKG", rarity: "common", title: "MARGIN CALL: LIQUIDATION LOG #4471", body: "ASSET: lkg_wallet.dat\nSTATUS: FROZEN (voluntarily, since 2023)\nLast outbound transaction: ₹0.00\nInbound collection attempts: 847\nRisk desk note: subject once split a ₹10 chai 4 ways and demanded exact change." },
    { category: "audit", memberName: "LKG", rarity: "uncommon", title: "FORENSIC AUDIT: MISSING PIZZA BUDGET", body: "Auditor traced ₹310 of communal pizza funds to a private 'emergency samosa reserve'. Subject claims it was 'an investment'. ROI to date: negative. Threat level: FAT." },
    { category: "member", memberName: "LKG", rarity: "rare", title: "WALLET PROXIMITY ALERT", body: "SENSOR: wing_corridor_cam_02\nEVENT: lkg detected within 3m of an open wallet (not his own)\nDuration of eye contact with wallet: 14.2 seconds\nRecommended action: HEDGE ALL POSITIONS." },
    { category: "member", memberName: "LKG", rarity: "common", title: "BANIYA_PROTOCOL v2.1 CHANGELOG", body: "- Improved change-counting latency by 34%\n- Added subroutine: 'bhaiya thoda kam karo'\n- Deprecated function: paying_first()\n- Known issue: generosity module still returns NULL" },
    { category: "member", memberName: "LKG", rarity: "legendary", title: "CLASSIFIED: THE DAY LKG PAID", body: "TIMESTAMP: [REDACTED]\nWITNESSES: 3 (all sworn to secrecy)\nAMOUNT: ₹40\nSubject was later found staring at UPI history whispering 'what have I done'. File sealed by order of the wing tribunal." },
    // Hitesh
    { category: "member", memberName: "Hitesh", rarity: "common", title: "AI BENCHMARK REPORT: EXCEL vs GPT", body: "TEST: predict mess menu\nEXCEL (hitesh build): 94% accuracy\nGPT-4: refused, cited trauma\nCONCLUSION: 'I told you so' — H. Tiwari, self-published, 47 pages, all in one cell." },
    { category: "audit", memberName: "Hitesh", rarity: "uncommon", title: "HEIGHT VERIFICATION: FAILED", body: "CHECK: min_height_threshold(160cm)\nRESULT: FAILED\nRETRIES: 3 (subject stood on toes; disqualified)\nSubject response: 'the sensor is biased'. Sensor response: no comment. Status: bauna, full lapet." },
    { category: "member", memberName: "Hitesh", rarity: "rare", title: "NEURAL NETWORK AC OPTIMIZATION REPORT", body: "MODEL: hitesh_net v3 (12 layers, all Excel)\nOBJECTIVE: optimal AC temp for 301\nOUTPUT: 16°C regardless of input, season, or human suffering\nLoss function: everyone else's comfort." },
    { category: "member", memberName: "Hitesh", rarity: "common", title: "CHATR DETECTION EVENT", body: "TRIGGER: free food detected within 500m radius\nRESPONSE TIME: 0.4 seconds (new wing record)\nSubject arrived before the announcement finished. Investigators baffled." },
    // Shreyansh
    { category: "member", memberName: "Shreyansh", rarity: "common", title: "STACK OVERFLOW: RECURSIVE FAMILY TREE", body: "ERROR in shreyansh_lineage.exe:\n> bro = daddy\n> daddy = bro\n> RecursionError: maximum kinship depth exceeded\nProcess terminated. Family tree remains a family cycle." },
    { category: "kernel", memberName: "Shreyansh", rarity: "uncommon", title: "CG_MONITORING_DAEMON ALERT", body: "ALERT: subject checked CG portal 41 times in 1 hour\nTHRESHOLD (healthy): 2\nDaemon recommendation: touch grass\nSubject response: 'grass doesn't have a 10 CGPA'. Full gok gok." },
    { category: "member", memberName: "Shreyansh", rarity: "rare", title: "INTERCEPTED GRADE SIGNAL", body: "SIGNAL SOURCE: academic_section\nPAYLOAD: 9.87\nSubject reaction: filed formal complaint about the missing 0.13\nComplaint status: framed on wall as motivation." },
    // Anshul & Anmol
    { category: "member", memberName: "Anshul", rarity: "common", title: "STOCHASTIC WEAPONS AUDIT: TWIN UNITS", body: "UNIT: machine_gun.registered (anshul & anmol joint custody)\nP(fire) = 0.000% (n = 730 days of observation)\nStatus: LOADED, AIMED, INDEFINITELY PENDING\nIYKYK clearance required for further details." },
    { category: "myth", memberName: "Anmol", rarity: "legendary", title: "MYTH FILE: THE UNFIRED SHOT", body: "Legend speaks of a day the machine gun will fire.\nProphecy conditions: [DATA EXPUNGED]\nProbability matrix suggests heat death of universe occurs first.\nBelievers: 12. Skeptics: also 12. Overlap: total." },
    { category: "audit", memberName: "Anshul", rarity: "uncommon", title: "WEAPONS REGISTRY: STATUS UPDATE", body: "REGISTRY ID: MG-2023-BILLU\nOWNERS: anshul, anmol (co-signatories)\nINSPECTIONS PASSED: all\nROUNDS FIRED: 0\nAnnual renewal note: 'next year pakka' — 3rd consecutive year." },
    // Tushar
    { category: "member", memberName: "Tushar", rarity: "common", title: "MEASURE THEORY PROOF: HEIGHT (FAILED)", body: "THEOREM: lim(n→∞) tushar_height(n) exists and is positive\nPROOF ATTEMPT: by contradiction\nRESULT: limit approaches negative values. Proof abandoned.\nPeer review: 'confirmed bahuna' (3 reviewers, unanimous)." },
    { category: "kernel", memberName: "Tushar", rarity: "uncommon", title: "BIOMETRIC SCAN: BELOW_MIN_THRESHOLD", body: "SCANNER: hostel_gate_v2\nERROR: subject not detected at standard scan height\nFALLBACK: child sensor activated. MATCH FOUND.\nSubject filed complaint. Complaint dismissed on grounds of accuracy." },
    { category: "member", memberName: "Tushar", rarity: "rare", title: "GRAVITY SIMULATION ERROR", body: "SIM: wing_physics_engine\nANOMALY: gravitational pull near tushar 2.3% stronger than expected\nHYPOTHESIS: density compensation for reduced volume\nStatus: confirmed dwarf star classification pending." },
    // Non-member
    { category: "kernel", rarity: "common", title: "KERNEL PANIC: MESS FOOD DETECTED", body: "PANIC at digestive_system.ko:\nUnhandled exception: 'dal' identified as 87% water, 13% hope\nStack trace ends at mess_contract.pdf\nSystem will now reboot on Maggi." },
    { category: "patch", rarity: "common", title: "PATCH NOTES v4.2.0", body: "- DEPRECATED: 8AM classes (nobody attended the funeral either)\n- FIXED: nothing\n- KNOWN ISSUES: everything\n- NEW: snooze now supports 14 consecutive activations" },
    { category: "audit", rarity: "uncommon", title: "CAFETERIA MOLECULAR ANALYSIS", body: "SAMPLE: 'paneer' (allegedly)\nCOMPOSITION: 60% mystery, 30% regret, 10% actual paneer\nRECOMMENDATION: reclassify as an experience, not a food\nFDA status: FDA has requested to remain uninvolved." },
    { category: "misc", rarity: "common", title: "TODO.md (RECOVERED)", body: "[ ] study for endsems\n[ ] fix sleep schedule\n[ ] call home\n[x] buy maggi (24 pack)\n[x] buy backup maggi\n[x] hide maggi from hitesh\n[ ] everything else" },
    { category: "myth", rarity: "rare", title: "CORRUPTED ROOF RECORDS", body: "FILE: roof_access_log.db — CORRUPTED\nRecoverable fragments: '...3AM...', '...guitar (badly)...', '...saw something...', '...we don't talk about it...'\nRestoration attempts: blocked by unanimous wing vote." },
  ])
  console.log("[v0] System leaks seeded")

  // ─── Activity log ────────────────────────────────────────────────────────
  await db.insert(activityLog).values([
    { userId: u("tushar"), type: "event_created", payload: { text: "[TICK] $MALL_ROAD_OUTING deployed by @tushar" } },
    { userId: u("hitesh"), type: "rsvp", payload: { text: "[LONG] @hitesh entered $POKER_NIGHT" } },
    { userId: u("lkg"), type: "match_logged", payload: { text: "[EXEC] $POKER match closed. Winner: @lkg (+₹1,300)" } },
    { userId: u("hitesh"), type: "expense_added", payload: { text: "[MARGIN] ₹1,240 exposure opened by @hitesh — Dominos damage" } },
    { userId: u("shreyansh"), type: "quote_added", payload: { text: "[INTERCEPT] new transmission logged by @shreyansh" } },
  ])
  console.log("[v0] Activity log seeded")

  console.log("[v0] Seed complete.")
}

main().catch((e) => {
  console.error("[v0] Seed failed:", e)
  process.exit(1)
})
