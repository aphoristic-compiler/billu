import { getStandalonePolls } from '@/lib/actions/polls'
import { getCurrentDbUser } from '@/lib/auth'
import { StandalonePollCard } from '@/components/surveys/standalone-poll-card'
import { CreatePollForm } from '@/components/surveys/create-poll-form'

export default async function SurveysPage() {
  const [polls, me] = await Promise.all([
    getStandalonePolls(),
    getCurrentDbUser(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-accent">
          MARKET_SURVEYS //
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Vote on wing-wide proposals. Standalone assets unattached to specific positions.
        </p>
      </div>

      <CreatePollForm />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {polls.map((poll) => (
          <StandalonePollCard key={poll.id} poll={poll as any} currentUserId={me?.id ?? ''} />
        ))}
        {polls.length === 0 && (
          <div className="col-span-full py-8 text-center border border-dashed border-border/50 rounded-lg">
            <p className="font-mono text-xs text-muted-foreground">NO_ACTIVE_SURVEYS</p>
          </div>
        )}
      </div>
    </div>
  )
}
