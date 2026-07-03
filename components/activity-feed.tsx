'use client'

import useSWR from 'swr'

interface ActivityItem {
  id: number
  message: string
  module: string | null
  createdAt: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const MODULE_TAGS: Record<string, string> = {
  events: 'EVNT',
  ledger: 'LDGR',
  games: 'GAME',
  vault: 'VLT',
  arcade: 'ARCD',
  system: 'SYS',
}

export function ActivityFeed() {
  const { data } = useSWR<{ items: ActivityItem[] }>('/api/activity', fetcher, {
    refreshInterval: 8000,
  })

  const items = data?.items ?? []

  return (
    <aside
      aria-label="Wing activity feed"
      className="hidden xl:flex w-72 shrink-0 flex-col border-l border-border bg-card/50"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          LIVE_FEED // SATURO_NET
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">awaiting_signal...</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded border border-border/60 bg-background/60 p-2 font-mono text-xs leading-relaxed"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="text-accent">
                    [{MODULE_TAGS[item.module ?? 'system'] ?? 'SYS'}]
                  </span>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <p className="mt-1 text-foreground/90 text-pretty">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
