import { getEventsWithDetails, getMembers } from '@/lib/actions/events'
import { getCurrentDbUser } from '@/lib/auth'
import { EventsBoard } from '@/components/events/events-board'

export default async function EventsPage() {
  const [events, members, me] = await Promise.all([
    getEventsWithDetails(),
    getMembers(),
    getCurrentDbUser(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-mono text-2xl font-bold text-primary">
          POSITIONS_DESK // EVENTS
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          deploy capital. go long on treats. hedge on trips.
        </p>
      </div>
      <EventsBoard
        events={JSON.parse(JSON.stringify(events))}
        members={JSON.parse(JSON.stringify(members))}
        currentUserId={me?.id ?? ''}
      />
    </div>
  )
}
