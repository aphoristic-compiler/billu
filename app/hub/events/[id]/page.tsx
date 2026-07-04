import { getTripDesk, getMembers } from '@/lib/actions/events'
import { getCurrentDbUser } from '@/lib/auth'
import { EventCard } from '@/components/events/events-board'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TripDeskBoard } from '@/components/events/trip-desk-board'

export default async function TripDeskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const [desk, members, me] = await Promise.all([
    getTripDesk(id),
    getMembers(),
    getCurrentDbUser(),
  ])

  if (!desk || !desk.parent) return notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link href="/hub/events" className="text-muted-foreground hover:text-accent font-mono text-xs">← back to floor</Link>
        </div>
        <h1 className="font-mono text-2xl font-bold text-accent">
          TRIP_DESK // {desk.parent.title.toUpperCase()}
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          manage sub-positions, micro-events, and logistics for this operation.
        </p>
      </div>
      
      {/* Parent Event */}
      <div className="rounded border-2 border-accent/20 bg-accent/5 p-1">
        <EventCard event={desk.parent as any} members={members as any} currentUserId={me?.id ?? ''} isTripDesk={true} />
      </div>

      <div className="border-t border-border/40 pt-4">
        <h2 className="font-mono text-lg font-bold text-primary mb-4">SUB_POSITIONS</h2>
        <TripDeskBoard 
          parentEventId={id} 
          childrenEvents={desk.children as any[]} 
          members={members as any} 
          currentUserId={me?.id ?? ''} 
        />
      </div>
    </div>
  )
}
