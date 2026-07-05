'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

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
    <>
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
    </header>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="md:hidden fixed inset-0 z-[100] flex justify-end" style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
              onClick={() => setIsMobileOpen(false)}
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-3/4 max-w-sm flex-col border-l border-primary/30 h-full p-6 shadow-2xl font-mono flex z-50 overflow-y-auto"
              style={{ 
                backgroundColor: '#050505',
                backgroundImage: 'radial-gradient(circle at 50% 0%, #1a1a1a 0%, #050505 70%)'
              }}
            >
              {/* Terminal Header */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-primary/20">
                <div>
                  <span className="font-bold text-primary tracking-widest block text-lg">SATURO://</span>
                  <span className="text-[10px] text-accent mt-1 block opacity-70">SYSTEM_MENU_ACTIVE</span>
                </div>
                <button 
                  onClick={() => setIsMobileOpen(false)}
                  className="text-primary hover:text-loss transition-colors bg-primary/10 p-2 rounded-sm border border-primary/20"
                >
                  <X size={18} />
                </button>
              </div>
              
              <nav className="flex flex-col gap-3">
                {LINKS.map((link, idx) => {
                  const active =
                    link.href === '/hub' ? pathname === '/hub' : pathname.startsWith(link.href)
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 + 0.1 }}
                      key={link.href}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'relative group flex flex-col px-4 py-3 border rounded-sm transition-all overflow-hidden',
                          active
                            ? 'bg-primary/10 border-primary/50 text-primary shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                            : 'bg-black/40 border-white/5 hover:border-primary/30 text-muted-foreground'
                        )}
                      >
                        {/* Scanline effect for active item */}
                        {active && (
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-50 pointer-events-none" />
                        )}
                        
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-[10px] font-bold tracking-widest",
                            active ? "text-primary" : "text-accent/50"
                          )}>
                            [{link.code}]
                          </span>
                          {active && <span className="w-1.5 h-1.5 bg-primary animate-pulse rounded-full" />}
                        </div>
                        <span className={cn(
                          "font-bold tracking-wide uppercase text-sm",
                          active ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                        )}>
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  )
                })}
              </nav>

              <div className="mt-auto pt-6">
                <div className="p-3 bg-black/60 border border-border/50 rounded-sm text-xs text-muted-foreground">
                  <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                    <span className="text-accent/50">OPERATOR_ID</span>
                    <span className="text-primary truncate ml-2 max-w-[120px]">{memberName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-accent/50">CONNECTION</span>
                    <span className="text-green-500 animate-pulse">SECURE</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
