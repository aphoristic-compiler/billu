'use client'

import { useTransition } from 'react'
import { voteStandalonePoll, togglePollPin } from '@/lib/actions/polls'
import { terminalToast } from '@/components/terminal-toast'

interface PollOption {
  id: string
  label: string
  votes: { userId: string }[]
}

interface Poll {
  id: string
  question: string
  isPinned?: boolean
  creator?: { username: string } | null
  options: PollOption[]
}

export function StandalonePollCard({ poll, currentUserId }: { poll: Poll; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)

  return (
    <div className="flex flex-col gap-2 rounded border border-border/40 bg-card/40 p-4">
      <div className="flex justify-between items-start">
        <p className="font-mono text-sm text-accent">[MARKET_SURVEY] {poll.question}</p>
        <div className="flex gap-2">
          {poll.creator && (
            <span className="font-mono text-xs text-muted-foreground">@{poll.creator.username}</span>
          )}
          {poll.isPinned !== undefined && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await togglePollPin(poll.id)
                    terminalToast(poll.isPinned ? 'Survey removed from watchlist.' : 'Survey added to watchlist.')
                  } catch (e: any) {
                    terminalToast(e.message, 'error')
                  }
                })
              }}
              className="font-mono text-xs text-muted-foreground hover:text-warning"
            >
              {poll.isPinned ? '[📌 unwatch]' : '[📌 watch]'}
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {poll.options.map((opt) => {
          const count = opt.votes.length
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const hasVoted = opt.votes.some((v) => v.userId === currentUserId)

          return (
            <div key={opt.id} className="relative overflow-hidden rounded border border-border/30 bg-background/50 group cursor-pointer hover:border-accent/50 transition-colors">
              <div
                className="absolute inset-y-0 left-0 bg-accent/20 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => voteStandalonePoll(opt.id))}
                className="relative flex w-full items-center justify-between p-2 font-mono text-xs"
              >
                <span className="text-foreground z-10 flex items-center gap-2">
                  {hasVoted && <span className="text-accent">✓</span>}
                  {opt.label}
                </span>
                <span className="text-muted-foreground z-10">{pct}% ({count})</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
