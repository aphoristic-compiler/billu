'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EventCard } from '@/components/events/events-board'
import { addMicroEvent } from '@/lib/actions/events'
import { toast as terminalToast } from '@/components/terminal-toast'

const LOCATION_LABELS: Record<string, string> = {
  rehdi: 'Rehdi',
  c_not: 'C-Not',
  fm: 'FM',
  '301': 'Room 301',
  looters: 'Looters',
  dominos: "Domino's",
  outside_campus: 'Outside Campus',
  other: 'Other',
}

function CreateMicroEventForm({ parentEventId, onClose }: { parentEventId: string, onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="rounded border border-primary/50 bg-card p-4 mb-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const title = String(fd.get('title') ?? '').trim()
        if (!title) {
          terminalToast('A position needs a name.', 'error')
          return
        }
        startTransition(async () => {
          await addMicroEvent(parentEventId, {
            title,
            location: String(fd.get('location')),
            locationCustom: String(fd.get('locationCustom') ?? ''),
            startsAt: String(fd.get('startsAt') ?? '') || undefined,
          })
          terminalToast('Sub-position deployed to the trip desk.')
          onClose()
          router.refresh()
        })
      }}
    >
      <h3 className="font-mono text-sm font-bold text-primary">DEPLOY_SUB_POSITION</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">title</span>
          <input name="title" required placeholder="Dinner at Dhaba" className="rounded border border-input bg-background px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">location</span>
          <select name="location" defaultValue="outside_campus" className="rounded border border-input bg-background px-2 py-1.5">
            {Object.entries(LOCATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">custom location (if other)</span>
          <input name="locationCustom" placeholder="e.g. that one dhaba" className="rounded border border-input bg-background px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">starts at</span>
          <input name="startsAt" type="datetime-local" className="rounded border border-input bg-background px-2 py-1.5" />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="font-mono text-xs text-muted-foreground hover:text-foreground">abort</button>
        <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-1 font-mono text-xs text-primary-foreground disabled:opacity-50">
          {pending ? 'DEPLOYING...' : 'DEPLOY_POSITION'}
        </button>
      </div>
    </form>
  )
}

export function TripDeskBoard({
  parentEventId,
  childrenEvents,
  members,
  currentUserId,
}: {
  parentEventId: string
  childrenEvents: any[]
  members: any[]
  currentUserId: string
}) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <CreateMicroEventForm parentEventId={parentEventId} onClose={() => setCreating(false)} />
      ) : (
        <div>
          <button 
            onClick={() => setCreating(true)}
            className="rounded border border-primary px-4 py-2 font-mono text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            + OPEN_NEW_SUB_POSITION
          </button>
        </div>
      )}

      {childrenEvents.length === 0 ? (
        <p className="rounded border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
          No sub-positions in this trip yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {childrenEvents.map((e) => (
            <EventCard key={e.id} event={e} members={members} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  )
}
