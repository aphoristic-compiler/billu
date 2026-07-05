'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/hub', label: 'DASHBOARD', code: '00' },
  { href: '/hub/events', label: 'EVENTS', code: '01' },
  { href: '/hub/ledger', label: 'MARGIN_CALL', code: '02' },
  { href: '/hub/games', label: 'GAME_TRACKER', code: '03' },
  { href: '/hub/vault', label: 'VAULT', code: '04' },
  { href: '/hub/arcade', label: 'ARCADE', code: '05' },
]

export function HubNav({ memberName }: { memberName: string }) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <span 
            className="font-mono text-sm font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent('open-terminal'))}
            title="Open Developer Terminal"
          >
            SATURO://
          </span>
          <span className="hidden md:inline font-mono text-xs text-muted-foreground">
            wing_terminal v2.0
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline font-mono text-xs text-accent">
            operator: {memberName}
          </span>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex overflow-x-auto border-t border-border/60">
        {LINKS.map((link) => {
          const active =
            link.href === '/hub' ? pathname === '/hub' : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'shrink-0 border-r border-border/60 px-4 py-2 font-mono text-xs tracking-wider transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <span className="text-accent/70">{link.code}_</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
