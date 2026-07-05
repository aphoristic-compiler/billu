'use client'

import { useTransition } from 'react'
import { voteStandalonePoll, togglePollPin, deletePoll, archivePoll, blastPollToWing } from '@/lib/actions/polls'
import { broadcastToWing } from '@/lib/actions/push'
import { toast } from '@/components/terminal-toast'
import { useState } from 'react'
import { EditPollDialog } from './edit-poll-dialog'
import { InlineConfirmButton } from '@/components/inline-confirm-button'

interface PollOption {
  id: string
  label: string
  votes: { userId: string; user?: { username: string } | null }[]
}

interface Poll {
  id: string
  question: string
  isPinned?: boolean
  isAnonymous?: boolean
  creator?: { id: string; username: string } | null
  options: PollOption[]
}

export function StandalonePollCard({ poll, currentUserId }: { poll: Poll; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)
  
  const isCreator = poll.creator && poll.creator.id === currentUserId

  return (
    <div className="flex flex-col gap-2 rounded border border-border/40 bg-card/40 p-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-accent">
              [MARKET_SURVEY]
            </span>
            {poll.isAnonymous && (
              <span className="rounded border border-muted-foreground/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ANONYMOUS
              </span>
            )}
          </div>
          <h3 className="mt-1 font-mono text-lg font-bold text-balance text-primary">
            {poll.question}
          </h3>
          {poll.creator && (
            <p className="font-mono text-xs text-muted-foreground mt-1">
              @{poll.creator.username}
            </p>
          )}
        </div>
        
        <div className="flex shrink-0 flex-col gap-1 items-end self-start">
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
              className="font-mono text-xs text-muted-foreground hover:text-warning transition-colors whitespace-nowrap"
            >
              {poll.isPinned ? '[📌 unwatch]' : '[📌 watch]'}
            </button>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const res = await blastPollToWing(poll.id)
                  if (res && res.success) {
                    toast('Blast sent to all operators.')
                  } else {
                    toast(res?.error || 'Blast failed: Check server logs.', 'error')
                  }
                } catch (e: any) {
                  toast(e.message, 'error')
                }
              })
            }}
            className="font-mono text-xs text-muted-foreground hover:text-profit transition-colors whitespace-nowrap"
            title="Blast Notification to Wing"
          >
            [🚀 blast]
          </button>
          
          {isCreator && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                [edit]
              </button>
              <InlineConfirmButton
                disabled={pending}
                onClick={() => startTransition(async () => {
                  try {
                    await deletePoll(poll.id)
                    toast('Survey Liquidated.', 'success')
                  } catch(e: any) {
                    toast(e.message, 'error')
                  }
                })}
                idleLabel="[liquidate]"
                confirmLabel="[CONFIRM_LIQUIDATE?]"
                idleClassName="font-mono text-xs text-muted-foreground hover:text-destructive transition-colors"
                confirmClassName="text-destructive font-bold text-xs font-mono"
              />
              <InlineConfirmButton
                disabled={pending}
                onClick={() => startTransition(async () => {
                  try {
                    await archivePoll(poll.id)
                    toast('Survey Vaulted.', 'success')
                  } catch(e: any) {
                    toast(e.message, 'error')
                  }
                })}
                idleLabel="[liquidate & vault]"
                confirmLabel="[CONFIRM_VAULT?]"
                idleClassName="font-mono text-xs text-muted-foreground hover:text-profit transition-colors"
                confirmClassName="text-profit font-bold text-xs font-mono"
              />
            </>
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
              <div className="relative">
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
                
                {!poll.isAnonymous && opt.votes.length > 0 && (
                  <div className="z-10 relative px-2 pb-2 flex flex-wrap gap-1">
                    {opt.votes.map((v, idx) => (
                      <span key={idx} className="text-[10px] text-muted-foreground/80 font-mono">
                        @{v.user?.username || v.userId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <EditPollDialog isOpen={isEditing} onClose={() => setIsEditing(false)} poll={poll} />
    </div>
  )
}
