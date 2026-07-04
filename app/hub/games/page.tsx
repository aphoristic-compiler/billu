import { getGamesData } from '@/lib/actions/matches'
import { getCurrentDbUser } from '@/lib/auth'
import { GameTracker } from '@/components/games/game-tracker'

export default async function GamesPage() {
  const [{ games, matches, members }, me] = await Promise.all([
    getGamesData(),
    getCurrentDbUser(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-mono text-2xl font-bold text-primary">
          WING_SCOREBOARD
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Track real-life matches, poker nights, and wing rivalries.
        </p>
      </div>
      <GameTracker
        games={JSON.parse(JSON.stringify(games))}
        matches={JSON.parse(JSON.stringify(matches))}
        members={JSON.parse(JSON.stringify(members))}
        currentUserId={me?.id ?? ''}
      />
    </div>
  )
}
