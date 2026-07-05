'use client'

import { useTransition } from 'react'
import { voteStandalonePoll, togglePollPin, deletePoll, archivePoll } from '@/lib/actions/polls'
import { broadcastToWing } from '@/lib/actions/push'
import { toast } from '@/components/terminal-toast'
import { useState } from 'react'
import { EditPollDialog } from './edit-poll-dialog'

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
  const [isEditing, setIsEditing] = useState(false)
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
  
  const isCreator = poll.creator && poll.creator.username === currentUserId

  return (
    <div className="flex flex-col gap-2 rounded border border-border/40 bg-card/40 p-4">
      <div className="flex justify-between items-start">
        <p className="font-mono text-sm text-accent">[MARKET_SURVEY] {poll.question}</p>
        <div className="flex gap-2">
          {poll.creator && (
            <span className="font-mono text-xs text-muted-foreground">@{poll.creator.username}</span>
          )}
          {poll.creator && poll.creator.username === currentUserId && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await broadcastToWing(
                      "📊 NEW MARKET SURVEY", 
                      `@${poll.creator?.username} just dropped a poll: ${poll.question}`
                    )
                    toast('Blast sent to all operators.')
                  } catch (e: any) {
                    toast(e.message, 'error')
                  }
                })
              }}
              className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
              title="Blast Notification to Wing"
            >
              [🚀 blast]
            </button>
          )}
          {poll.isPinned !== undefined && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await togglePollPin(poll.id)
                    toast(poll.isPinned ? 'Survey removed from watchlist.' : 'Survey added to watchlist.')
                  } catch (e: any) {
                    toast(e.message, 'error')
                  }
                })
              }}
              className="font-mono text-xs text-muted-foreground hover:text-warning transition-colors"
            >
              {poll.isPinned ? '[📌 unwatch]' : '[📌 watch]'}
            </button>
          )}
        </div>
      </div>
      
      {isCreator && (
        <div className="flex gap-2 text-xs border-b border-border/50 pb-2 mb-2">
          <button
            onClick={() => setIsEditing(true)}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            [edit]
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => {
              try {
                await archivePoll(poll.id)
                toast('Survey Vaulted.', 'success')
              } catch(e: any) {
                toast(e.message, 'error')
              }
            })}
            className="text-muted-foreground hover:text-warning transition-colors"
          >
            [vault]
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(async () => {
              try {
                await deletePoll(poll.id)
                toast('Survey Liquidated.', 'success')
              } catch(e: any) {
                toast(e.message, 'error')
              }
            })}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            [liquidate]
          </button>
        </div>
      )}
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
                onClick={() => startTransition(() => voteStandalonePoll(poll.id, opt.id))}
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
      <EditPollDialog isOpen={isEditing} onClose={() => setIsEditing(false)} poll={poll} />
    </div>
  )
}
