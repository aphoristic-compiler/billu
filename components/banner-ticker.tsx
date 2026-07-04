'use client'

import { useEffect, useRef, useState } from 'react'

export function BannerTicker({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  // Split the banner into sentences for the ticker segments
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0)

  // We duplicate the content so the scroll loops seamlessly
  const tickerContent = [...sentences, ...sentences]

  return (
    <div
      ref={containerRef}
      className="w-full bg-accent/10 border-y border-accent/20 overflow-hidden relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div
        ref={contentRef}
        className="flex items-center whitespace-nowrap py-2.5"
        style={{
          animation: `ticker-scroll ${Math.max(sentences.length * 4, 15)}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {tickerContent.map((sentence, i) => (
          <span key={i} className="inline-flex items-center shrink-0">
            <span className="font-mono text-xs text-accent/80 px-4">
              {sentence.trim()}
            </span>
            <span className="text-accent/30 text-[10px] px-2">◆</span>
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
