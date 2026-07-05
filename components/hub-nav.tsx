'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/hub', label: 'DASHBOARD', code: '00' },
  { href: '/hub/events', label: 'EVENTS', code: '01' },
  { href: '/hub/ledger', label: 'MARGIN_CALL', code: '02' },
  { href: '/hub/games', label: 'GAME_TRACKER', code: '03' },
  { href: '/hub/vault', label: 'VAULT', code: '04' },
  { href: '/hub/arcade', label: 'ARCADE', code: '05' },
  { href: '/hub/surveys', label: 'MARKET_SURVEYS', code: '06' },
]

export function HubNav({ memberName }: { memberName: string }) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <button 
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setIsMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
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
      <nav aria-label="Main navigation" className="hidden md:flex border-t border-border/60">
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

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative w-64 max-w-sm flex-col bg-background/95 backdrop-blur-2xl border-r border-border h-full p-4 shadow-2xl font-mono flex">
            <div className="flex items-center justify-between mb-8">
              <span className="font-bold text-primary">SATURO://</span>
              <button 
                onClick={() => setIsMobileOpen(false)}
                className="text-muted-foreground hover:text-loss transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <nav className="flex flex-col gap-2">
              {LINKS.map((link) => {
                const active =
                  link.href === '/hub' ? pathname === '/hub' : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'px-4 py-3 border border-border/50 rounded transition-colors',
                      active
                        ? 'bg-primary/10 border-primary/50 text-primary'
                        : 'hover:bg-secondary/10 hover:border-secondary/50 text-muted-foreground'
                    )}
                  >
                    <span className="text-accent/70 text-[10px] block mb-1">{link.code}_</span>
                    <span className="font-bold">{link.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground text-center">
              operator: {memberName}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
