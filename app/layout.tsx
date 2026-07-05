import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, VT323 } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-vt323',
})

export const metadata: Metadata = {
  title: 'The Wing Hub — Billu Wing Terminal',
  description:
    'Digital memorial, event planner, game tracker, expense splitter, quotes archive, and AI arcade for Billu Wing.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'BILLU HUB',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0B0C10',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      afterSignInUrl="/hub"
      afterSignUpUrl="/hub"
    >
      <html
        lang="en"
        className={`bg-background ${jetbrainsMono.variable} ${vt323.variable}`}
      >
        <body className="antialiased font-mono">
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </body>
      </html>
    </ClerkProvider>
  )
}
