'use client'

export function QuoteTicker({ quotes }: { quotes: string[] }) {
  if (quotes.length === 0) return null
  const line = quotes.join('  ///  ')

  return (
    <div
      aria-label="Quotes ticker"
      className="relative overflow-hidden rounded border border-border bg-card/70 py-2"
    >
      <div className="animate-ticker flex w-max gap-8 whitespace-nowrap font-mono text-xs text-accent">
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </div>
  )
}
