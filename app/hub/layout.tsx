import { redirect } from 'next/navigation'
import { getCurrentDbUser } from '@/lib/auth'
import { HubNav } from '@/components/hub-nav'
import { ActivityFeed } from '@/components/activity-feed'
import { HiddenTerminal } from '@/components/hidden-terminal'
import { BootGate } from '@/components/boot-gate'
import { ToastHost } from '@/components/terminal-toast'
import { PushManager } from '@/components/push-manager'

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentDbUser()
  if (!user) redirect('/sign-in')

  return (
    <BootGate seen={user.bootSequenceSeen ?? false}>
      <div className="flex min-h-screen flex-col">
        <HubNav memberName={user.displayName} />
        <div className="flex flex-1">
          <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
          <ActivityFeed />
        </div>
      </div>
      <HiddenTerminal />
      <ToastHost />
      <PushManager />
    </BootGate>
  )
}
