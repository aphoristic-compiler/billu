import { getArcadeData } from '@/lib/actions/arcade'
import { getCurrentDbUser } from '@/lib/auth'
import { ArcadeConsole } from '@/components/arcade/arcade-console'

export default async function ArcadePage() {
  const [{ active, leaderboard }, me] = await Promise.all([
    getArcadeData(),
    getCurrentDbUser(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-mono text-2xl font-bold text-primary">
          DERIVATIVES_LAB // AI_ARCADE
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          describe a game. gemini compiles it. the wing competes on it.
        </p>
      </div>
      <ArcadeConsole
        active={active ? JSON.parse(JSON.stringify(active)) : null}
        leaderboard={JSON.parse(JSON.stringify(leaderboard))}
        currentUserId={me?.id ?? ''}
      />
    </div>
  )
}
