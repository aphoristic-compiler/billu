import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { desc, eq } from 'drizzle-orm'
import { db, activeArcadeGame } from '@/lib/db'
import { getCurrentDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export const maxDuration = 60

const COOLDOWN_MS = 5 * 60 * 1000

const SYSTEM_PROMPT = `Generate a self-contained, responsive HTML/JS 2D game based on the user's prompt.
Rules:
- Do NOT use external assets, CDNs, or images. Use only canvas/SVG graphics.
- The game must be playable and have a clear win/lose condition.
- When the game ends, call: window.parent.postMessage({ type: 'GAME_OVER', score: finalScore, time: timePlayed }, '*')
- Support both keyboard and touch controls where sensible.
- Dark theme: background #0B0C10, accents #34C759 / #FF3B30 / #FFD60A.
- Return ONLY the raw HTML code, no markdown fences.`

export async function POST(req: Request) {
  const user = await getCurrentDbUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { prompt } = (await req.json()) as { prompt?: string }
  if (!prompt?.trim() || prompt.length > 500) {
    return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
  }

  // Cooldown: one generation per user per 5 minutes
  const [lastByUser] = await db
    .select()
    .from(activeArcadeGame)
    .where(eq(activeArcadeGame.generatedBy, user.id))
    .orderBy(desc(activeArcadeGame.createdAt))
    .limit(1)

  if (lastByUser) {
    const elapsed = Date.now() - new Date(lastByUser.createdAt).getTime()
    if (elapsed < COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'cooldown', retryAfterMs: COOLDOWN_MS - elapsed },
        { status: 429 },
      )
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${SYSTEM_PROMPT}\n\nUser's game prompt: ${prompt.trim()}`,
    })

    let code = response.text ?? ''
    // strip markdown fences if the model disobeys
    code = code
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim()

    if (!code.toLowerCase().includes('<html') && !code.toLowerCase().includes('<canvas')) {
      return NextResponse.json({ error: 'generation_failed' }, { status: 502 })
    }

    // deactivate previous game
    await db
      .update(activeArcadeGame)
      .set({ isActive: false })
      .where(eq(activeArcadeGame.isActive, true))

    const [game] = await db
      .insert(activeArcadeGame)
      .values({
        prompt: prompt.trim(),
        generatedCode: code,
        generatedBy: user.id,
        isActive: true,
      })
      .returning()

    await logActivity(
      user.id,
      'arcade_generated',
      `[COMPILE] new simulation deployed to sandbox by @${user.username} — "${prompt.trim().slice(0, 60)}"`,
    )

    return NextResponse.json({ id: game.id, code: game.generatedCode, prompt: game.prompt })
  } catch (e) {
    console.error('[v0] Gemini generation failed:', e)
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 })
  }
}
