import { getDashboardData } from '@/lib/actions/dashboard'
import { getDailyBanner } from '@/lib/actions/banner'
import { getMembers } from '@/lib/actions/events'
import { EventCard } from '@/components/events/events-board'
import { StandalonePollCard } from '@/components/surveys/standalone-poll-card'
import Link from 'next/link'
import { Activity, Gamepad2, Landmark, Wallet, Vault } from 'lucide-react'
import { BannerTicker } from '@/components/banner-ticker'

export default async function HubDashboard() {
  const [data, bannerText, members] = await Promise.all([
    getDashboardData(),
    getDailyBanner(),
    getMembers(),
  ])

  return (
    <div className="space-y-6">
      {/* Daily AI Banner — scrolling ticker */}
      <BannerTicker text={bannerText} />

      {/* Welcome Section */}
      <section className="border border-border bg-card/50 p-6 rounded-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Landmark size={120} />
        </div>
        <h1 className="font-mono text-2xl font-bold text-primary relative z-10">
          WELCOME_BACK, @{data.user.username}
        </h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground max-w-lg relative z-10">
          Saturo Wing Central Dashboard. Monitor your positions, track capital exposure, and deploy assets into the vault.
        </p>
      </section>

      {/* Watchlist Section */}
      {(data.pinnedEvents?.length > 0 || data.pinnedPolls?.length > 0) && (
        <section className="space-y-4">
          <h2 className="font-mono text-lg font-bold text-warning border-b border-warning/50 pb-2">
            WATCHLIST_ASSETS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pinnedEvents?.map(event => (
              <EventCard key={event.id} event={event as any} members={members as any} currentUserId={data.user.id} />
            ))}
            {data.pinnedPolls?.map(poll => (
              <StandalonePollCard key={poll.id} poll={poll as any} currentUserId={data.user.id} />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Quick Links */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Link href="/hub/events" className="group p-4 border border-border bg-card rounded-lg hover:border-accent hover:bg-accent/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-accent">
              <Activity size={20} />
              <h3 className="font-mono text-sm font-bold">POSITIONS (EVENTS)</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Manage trips, outings, and micro-events.
            </p>
          </Link>

          <Link href="/hub/surveys" className="group p-4 border border-border bg-card rounded-lg hover:border-warning hover:bg-warning/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-warning">
              <Activity size={20} />
              <h3 className="font-mono text-sm font-bold">MARKET_SURVEYS</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Vote on standalone wing-wide proposals.
            </p>
          </Link>

          <Link href="/hub/ledger" className="group p-4 border border-border bg-card rounded-lg hover:border-profit hover:bg-profit/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-profit">
              <Wallet size={20} />
              <h3 className="font-mono text-sm font-bold">LEDGER</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Track debts and settle margin calls.
            </p>
          </Link>

          <Link href="/hub/arcade" className="group p-4 border border-border bg-card rounded-lg hover:border-warning hover:bg-warning/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-warning">
              <Gamepad2 size={20} />
              <h3 className="font-mono text-sm font-bold">ARCADE</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Play Mistral-generated games and compete.
            </p>
          </Link>

          <Link href="/hub/vault" className="group p-4 border border-border bg-card rounded-lg hover:border-secondary hover:bg-secondary/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-secondary">
              <Vault size={20} />
              <h3 className="font-mono text-sm font-bold">VAULT</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Access the centralized file system.
            </p>
          </Link>

          <Link href="/hub/analytics" className="group p-4 border border-border bg-card rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition-all">
            <div className="flex items-center gap-3 mb-2 text-blue-500">
              <Activity size={20} />
              <h3 className="font-mono text-sm font-bold">SYSTEM_ANALYTICS</h3>
            </div>
            <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
              Wing-wide metrics and performance tracking.
            </p>
          </Link>
        </div>

        {/* Ledger Summary Widget */}
        <div className="border border-border bg-card rounded-lg p-5 flex flex-col">
          <h3 className="font-mono text-sm font-bold text-muted-foreground mb-4 border-b border-border/50 pb-2">
            YOUR_PORTFOLIO
          </h3>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-6">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Net Balance</p>
              <p className={`font-mono text-3xl font-bold ${data.netBalance > 0 ? 'text-profit' : data.netBalance < 0 ? 'text-loss' : 'text-foreground'}`}>
                {data.netBalance > 0 ? '+' : ''}₹{data.netBalance.toFixed(2)}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center border-t border-border/30 pt-4">
              <div>
                <p className="font-mono text-[10px] text-loss mb-1">Owed By You</p>
                <p className="font-mono text-sm text-loss font-bold">₹{data.totalUserOwes.toFixed(2)}</p>
              </div>
              <div className="border-l border-border/30">
                <p className="font-mono text-[10px] text-profit mb-1">Owed To You</p>
                <p className="font-mono text-sm text-profit font-bold">₹{data.totalOwedToUser.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <Link href="/hub/ledger" className="mt-6 w-full text-center border border-border py-2 rounded font-mono text-xs hover:bg-card-hover transition-colors">
            OPEN_LEDGER →
          </Link>
        </div>
      </div>

      {/* Activity Log */}
      <section className="border border-border bg-card rounded-lg p-5">
        <h3 className="font-mono text-sm font-bold text-accent mb-4 border-b border-border/50 pb-2">
          SYSTEM_LOG
        </h3>
        {data.recentActivity.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No recent activity detected.</p>
        ) : (
          <div className="space-y-3">
            {data.recentActivity.map(activity => (
              <div key={activity.id} className="flex gap-3 text-xs font-mono items-start border-l-2 border-border/50 pl-3">
                <span className="text-muted-foreground whitespace-nowrap">
                  [{new Date(activity.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}]
                </span>
                <span className="text-foreground">
                  {typeof activity.payload === 'object' && activity.payload !== null 
                    ? (activity.payload as any).text 
                    : JSON.stringify(activity.payload)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
