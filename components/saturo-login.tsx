'use client'

import { useEffect, useState } from 'react'
import { SignIn, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { BrownianCanvas } from '@/components/brownian-canvas'
import { HostileDrift } from '@/components/hostile-drift'
import { CandlestickButton } from '@/components/candlestick-button'
import { ToastHost, toast } from '@/components/terminal-toast'

export function SaturoLogin() {
  const [positionOpened, setPositionOpened] = useState(false)
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  // If already signed in (e.g. page refresh), skip straight to hub
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/hub')
    }
  }, [isLoaded, isSignedIn, router])

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <BrownianCanvas />
      <ToastHost />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <header className="text-center">
          <p className="font-display text-supernova text-lg tracking-widest">
            {'BILLU WING // ESOTERIC TRADING TERMINAL'}
          </p>
          <h1 className="font-display text-5xl text-chalk-bright md:text-6xl">
            THE WING HUB
          </h1>
          <p className="mt-1 text-xs text-chalk-dust">
            {'p-value: 0.0037 | REJECT H₀: "visitor is unworthy"'}
          </p>
        </header>

        {!positionOpened ? (
          <div className="flex flex-col items-center gap-4 border border-chalk-faded bg-card p-8">
            <p className="max-w-sm text-center text-sm leading-relaxed text-chalk-dust">
              Authentication is a market. Entry is only permitted while the
              candle prints green. Time your entry.
            </p>
            <CandlestickButton
              label="OPEN POSITION"
              onSuccess={() => {
                setPositionOpened(true)
                toast('POSITION OPENED — ENTRY CONFIRMED', 'profit')
              }}
            />
            <p className="text-xs text-chalk-faded">
              Mercy rule: 3 rejections force a green print.
            </p>
          </div>
        ) : (
          <HostileDrift>
            <div className="border border-profit/40 bg-card p-2">
              <SignIn
                forceRedirectUrl="/hub"
                fallbackRedirectUrl="/hub"
                appearance={{
                  variables: {
                    colorBackground: '#1A1E24',
                    colorText: '#F8F9FA',
                    colorPrimary: '#34C759',
                    colorTextSecondary: '#6C757D',
                    colorInputBackground: '#0B0C10',
                    colorInputText: '#F8F9FA',
                    borderRadius: '2px',
                    fontFamily: 'JetBrains Mono, monospace',
                  },
                }}
              />
            </div>
          </HostileDrift>
        )}

        <p className="text-center text-xs text-chalk-faded">
          {'There is no exit from Billu Wing.'}
        </p>
      </div>
    </main>
  )
}
