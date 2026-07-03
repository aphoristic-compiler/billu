'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, and } from 'drizzle-orm'
import { db, activeArcadeGame, arcadeLeaderboard } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function getArcadeData() {
  const [active] = await db
    .select()
    .from(activeArcadeGame)
    .where(eq(activeArcadeGame.isActive, true))
    .orderBy(desc(activeArcadeGame.createdAt))
    .limit(1)

  const leaderboard = active
    ? await db.query.arcadeLeaderboard.findMany({
        where: eq(arcadeLeaderboard.arcadeGameId, active.id),
        orderBy: [desc(arcadeLeaderboard.score)],
        with: { user: true },
      })
    : []

  return { active: active ?? null, leaderboard }
}

export async function generateGame() {
  const user = await requireDbUser()
  const { GoogleGenerativeAI } = await import('@google/genai')
  
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' })
  
  const prompt = `Generate a simple HTML5/JavaScript game. Return ONLY valid HTML that can be embedded in an iframe. Include:
- A complete game (snake, pong, flappy bird, breakout, or simple shooter)
- Canvas-based graphics
- Keyboard/mouse controls
- Score tracking variable called "gameScore"
- One function called "getScore()" that returns the current score

Return ONLY the HTML/CSS/JS code, no markdown or explanations.`
  
  const response = await model.generateContent(prompt)
  const htmlContent = response.response.text()
  
  // In a real scenario, save to DB and return
  await logActivity(user.id, 'game_generated', `[CIPHER] new game protocol instantiated`)
  
  return {
    id: `game_${Date.now()}`,
    title: 'AI Generated Game',
    description: 'A dynamically generated game from Gemini',
    htmlContent,
  }
}

export async function getArcadeGames() {
  // Return list of generated games (in real app, would fetch from DB)
  return []
}

export async function recordArcadeScore(gameId: string, score: number) {
  const user = await requireDbUser()
  await logActivity(user.id, 'arcade_score', `[BREACH] score ${score} recorded`)
  revalidatePath('/hub/arcade')
}

export async function getArcadeLeaderboard() {
  // Return top arcade scores
  return []
}

export async function submitScore(arcadeGameId: string, score: number, timePlayed: number) {
  const user = await requireDbUser()

  const [existing] = await db
    .select()
    .from(arcadeLeaderboard)
    .where(
      and(
        eq(arcadeLeaderboard.arcadeGameId, arcadeGameId),
        eq(arcadeLeaderboard.userId, user.id),
      ),
    )
    .limit(1)

  let isHighScore = false
  if (existing) {
    isHighScore = score > existing.score
    await db
      .update(arcadeLeaderboard)
      .set({
        score: Math.max(existing.score, Math.floor(score)),
        timePlayed: existing.timePlayed + timePlayed,
        attempts: existing.attempts + 1,
      })
      .where(eq(arcadeLeaderboard.id, existing.id))
  } else {
    isHighScore = true
    await db.insert(arcadeLeaderboard).values({
      arcadeGameId,
      userId: user.id,
      score: Math.floor(score),
      timePlayed,
    })
  }

  if (isHighScore && score > 0) {
    await logActivity(
      user.id,
      'high_score',
      `[BREACH] high_score.dat overwritten by @${user.username} — ${Math.floor(score).toLocaleString('en-IN')} pts`,
    )
  }

  revalidatePath('/hub/arcade')
}
