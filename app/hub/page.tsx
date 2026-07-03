import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db, quotes } from '@/lib/db'
import { getDashboardStats, getUserStats } from '@/lib/actions/stats'
import { QuoteTicker } from '@/components/quote-ticker'

export default async function DashboardPage() {
  const [stats, me, latestQuotes] = await Promise.all([
    getDashboardStats(),
    getUserStats(),
    db.query.quotes.findMany({ orderBy: [desc(quotes.createdAt)], limit: 20 }),
  ])

  const cards = [
    { label: 'OPEN_POSITIONS', sub: 'events deployed', value: stats.events, href: '/hub/events' },
    {
      label: 'PENDING_MARGIN',
      sub: 'unsettled exposure',
      value: `₹${stats.pendingDebt.toLocaleString('en-IN')}`,
      href: '/hub/ledger',
    },
    { label: 'MATCHES_EXEC', sub: 'games settled', value: stats.matches, href: '/hub/games' },
    { label: 'COLD_STORAGE', sub: 'archived artifacts', value: stats.archives, href: '/hub/vault' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-primary text-balance">
          SATURO_WING // MAIN_TERMINAL
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          session: @{me.username} · win_rate: {me.winRate}% · net_position:{' '}
          <span className={me.netDebt >= 0 ? 'text-primary' : 'text-destructive'}>
            {me.netDebt >= 0 ? '+' : '-'}₹{Math.abs(me.netDebt).toLocaleString('en-IN')}
          </span>
        </p>
      </div>

      <QuoteTicker quotes={latestQuotes.map((q) => `"${q.quote}" — ${q.attributedTo}`)} />

      <section aria-label="Wing statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group rounded border border-border bg-card p-4 transition-colors hover:border-primary/60"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold text-foreground group-hover:text-primary">
              {c.value}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{c.sub}</p>
          </Link>
        ))}
      </section>

      <section
        aria-label="Personal record"
        className="rounded border border-border bg-card p-4"
      >
        <h2 className="font-mono text-xs uppercase tracking-widest text-accent">
          OPERATOR_PROFILE // {me.displayName}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 font-mono text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">events_created</dt>
            <dd className="text-xl font-bold">{me.eventsCreated}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">matches_played</dt>
            <dd className="text-xl font-bold">{me.matchesPlayed}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">wins / losses</dt>
            <dd className="text-xl font-bold">
              <span className="text-primary">{me.wins}</span>
              {' / '}
              <span className="text-destructive">{me.losses}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">win_rate</dt>
            <dd className="text-xl font-bold text-accent">{me.winRate}%</dd>
          </div>
        </dl>
      </section>

      <p className="font-mono text-[10px] text-muted-foreground/60">
        {'>'} hint: press ~ to open the kernel shell. type `help` if you dare.
      </p>
    </div>
  )
}
