import { getAnalyticsData } from '@/lib/actions/analytics'
import { Trophy, TrendingUp, TrendingDown, Users, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-primary">
          SYSTEM_ANALYTICS //
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Wing-wide metrics and performance indicators.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Spender */}
        <div className="rounded-xl border border-profit/30 bg-card p-5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <TrendingUp size={100} />
          </div>
          <p className="font-mono text-[10px] text-profit uppercase tracking-widest mb-1 flex items-center gap-2">
            <TrendingUp size={12} /> Top Spender
          </p>
          <div className="mt-4">
            {data.topSpender ? (
              <>
                <p className="font-mono text-2xl font-bold text-foreground">
                  @{data.topSpender.username}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Floating ₹{data.topSpender.amount.toLocaleString()} in the market
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>

        {/* Top Borrower */}
        <div className="rounded-xl border border-warning/30 bg-card p-5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <TrendingDown size={100} />
          </div>
          <p className="font-mono text-[10px] text-warning uppercase tracking-widest mb-1 flex items-center gap-2">
            <TrendingDown size={12} /> Top Borrower
          </p>
          <div className="mt-4">
            {data.topBorrower ? (
              <>
                <p className="font-mono text-2xl font-bold text-foreground">
                  @{data.topBorrower.username}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Leveraged by ₹{data.topBorrower.amount.toLocaleString()}
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>

        {/* Socialite */}
        <div className="rounded-xl border border-accent/30 bg-card p-5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Users size={100} />
          </div>
          <p className="font-mono text-[10px] text-accent uppercase tracking-widest mb-1 flex items-center gap-2">
            <Users size={12} /> The Socialite
          </p>
          <div className="mt-4">
            {data.socialite ? (
              <>
                <p className="font-mono text-2xl font-bold text-foreground">
                  @{data.socialite.username}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Attended {data.socialite.count} positions
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>

        {/* Grinder */}
        <div className="rounded-xl border border-blue-500/30 bg-card p-5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <Flame size={100} />
          </div>
          <p className="font-mono text-[10px] text-blue-500 uppercase tracking-widest mb-1 flex items-center gap-2">
            <Flame size={12} /> The Grinder
          </p>
          <div className="mt-4">
            {data.grinder ? (
              <>
                <p className="font-mono text-2xl font-bold text-foreground">
                  @{data.grinder.username}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  Skipped {data.grinder.count} positions
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">No data</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Arcade Leaderboard */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-3">
            <Trophy size={16} className="text-warning" />
            <h2 className="font-mono text-sm font-bold text-foreground tracking-widest">WING_ARCADE_RANKING</h2>
          </div>
          
          {data.arcadeGlobal.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border/50 rounded bg-background/30">
              <p className="font-mono text-xs text-muted-foreground">No arcade data.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {data.arcadeGlobal.map((row, i) => (
                <div
                  key={row.username}
                  className="group flex items-center justify-between rounded px-3 py-2.5 font-mono text-xs bg-background/40 hover:bg-background/80 transition-colors border-l-2 border-transparent hover:border-border"
                >
                  <div className="flex items-center gap-4">
                    <span className={cn("font-bold", i === 0 ? "text-warning text-lg" : "text-muted-foreground")}>
                      {i === 0 ? '🏆' : `#${i + 1}`}
                    </span>
                    <span className="font-bold tracking-tight">@{row.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-bold tabular-nums text-sm text-foreground">
                      {row.score.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Game Tracker Leaderboard Placeholder */}
        <section className="rounded-xl border border-dashed border-border p-12 text-center bg-card/30 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-3 text-muted-foreground/50">
            ?
          </div>
          <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
            Game Tracker Uninitialized
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1 max-w-xs mx-auto">
            Requires Poker chips_in/chips_out integration to calculate net P/L.
          </p>
        </section>
      </div>
    </div>
  )
}
