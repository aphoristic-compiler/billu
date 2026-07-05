'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, and, sql } from 'drizzle-orm'
import { db, activeArcadeGame, arcadeLeaderboard, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import { queryMistral } from '@/lib/mistral'

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

  // Global Leaderboard (Sum of max scores per user across all games)
  const globalRaw = await db.execute(sql`
    WITH MaxScores AS (
      SELECT user_id, arcade_game_id, MAX(score) as max_score
      FROM arcade_leaderboard
      GROUP BY user_id, arcade_game_id
    )
    SELECT u.id as "userId", u.username, SUM(m.max_score) as "totalScore"
    FROM MaxScores m
    JOIN users u ON m.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY "totalScore" DESC
  `)

  const globalLeaderboard = globalRaw.map((r: any) => ({
    userId: r.userId,
    username: r.username,
    totalScore: Number(r.totalScore),
  }))

  return { active: active ?? null, leaderboard, globalLeaderboard }
}

function stripCodeFences(text: string) {
  return text
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
}

export async function generateGame(userPrompt: string) {
  const user = await requireDbUser()
  if (!userPrompt.trim()) throw new Error('Prompt required')

  const systemPrompt = `You are a master arcade game developer. Generate a complex, highly polished, and playable HTML5 game based on this request: "${userPrompt}"

STRICT REQUIREMENTS:
- Return ONLY a complete self-contained HTML document (inline CSS + JS). No markdown, no explanations, no code fences.
- Canvas-based, dark background (#0B0C10), neon green (#34C759) / red (#FF3B30) / gold (#FFD60A) accents, monospace font.
- Keyboard controls (arrows/WASD/space). Also support click/tap where sensible.
- Track an integer score. Show it on screen at all times.
- Implement polished game mechanics: increasing difficulty, multiple enemy types, power-ups, particle effects, and smooth animations (using requestAnimationFrame).
- Add sound effects using the Web Audio API if possible (synthesized sounds like beeps/boops for jumping/shooting/explosions).
- On game over, show a stylized "GAME OVER — SCORE: <n>" screen and call:
    window.parent.postMessage({ type: 'arcade_score', score: <n> }, '*')
- Also post the score every time it changes:
    window.parent.postMessage({ type: 'arcade_score_live', score: <n> }, '*')
- Include a "restart" key (R) to reset the state completely.
- You are not bound by line limits. Write as much code as needed to make the game deep, engaging, and feature-rich (can take up to 2-5 minutes to generate). It must run with zero external resources.`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  const responseText = await queryMistral(messages, user.id)

  const html = stripCodeFences(responseText ?? '')
  if (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<canvas')) {
    throw new Error('Model returned invalid game code')
  }

  // Deactivate previous games, activate the new one
  await db
    .update(activeArcadeGame)
    .set({ isActive: false })
    .where(eq(activeArcadeGame.isActive, true))

  const [game] = await db
    .insert(activeArcadeGame)
    .values({
      prompt: userPrompt,
      generatedCode: html,
      generatedBy: user.id,
      isActive: true,
    })
    .returning()

  await logActivity(
    user.id,
    'game_generated',
    `[CIPHER] new arcade protocol compiled by @${user.username}: "${userPrompt.slice(0, 60)}"`,
  )

  revalidatePath('/hub/arcade')
  return game
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
