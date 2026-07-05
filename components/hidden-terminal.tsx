'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLeakForMember, addLore } from '@/lib/actions/boot'
import { getUserStats } from '@/lib/actions/stats'
import { queryWingAI } from '@/lib/actions/ai'

type TermLine = { text: string; kind: 'input' | 'output' | 'error' }

const HELP = `Available commands:
  help                    this list
  whoami                  your wing stats
  cat anomaly/<name>      leak a member's file
  ls                      list wing files
  calc_alpha --user       trading-desk formatted stats
  sudo short anshul       attempt a short position
  rm -rf sleep_schedule   attempt cleanup
  history                 last 10 commands
  add_lore <name> <txt>   submit intel for a member
  <anything else>         ask Wing AI a question
  clear                   clear terminal
  exit                    attempt escape`

const LS_OUTPUT = `total 4
-rw-r--r--  debt_ledger.db          42K
-rw-r--r--  maggi_reserves.log      1.3M
-rw-------  poker_history.enc       ENCRYPTED
-rw-r--r--  sleep_schedule          0 bytes`

export function HiddenTerminal() {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<TermLine[]>([
    { text: 'BILLU WING KERNEL 4.0.4 — unauthorized access is expected', kind: 'output' },
    { text: "type 'help' for commands", kind: 'output' },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const inField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (e.key === '`' && !inField) {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const print = (text: string, kind: TermLine['kind'] = 'output') =>
    setLines((prev) => [...prev, { text, kind }])

  const run = useCallback(
    async (raw: string) => {
      const cmd = raw.trim()
      if (!cmd) return
      setHistory((h) => [...h.slice(-9), cmd])
      print(`$ ${cmd}`, 'input')

      const lower = cmd.toLowerCase()

      if (lower === 'help') {
        print(HELP)
      } else if (lower === 'clear') {
        setLines([])
      } else if (lower === 'exit') {
        print('There is no exit from Billu Wing.')
      } else if (lower === 'ls') {
        print(LS_OUTPUT)
      } else if (lower === 'history') {
        setHistory((h) => {
          h.slice(-10).forEach((c, i) => print(`  ${i + 1}  ${c}`))
          return h
        })
      } else if (lower === 'rm -rf sleep_schedule') {
        print('rm: cannot remove: was already deleted at orientation week.', 'error')
      } else if (lower.startsWith('sudo short')) {
        print('Permission denied: machine gun not loaded.', 'error')
      } else if (lower === 'whoami' || lower === 'calc_alpha --user') {
        print('querying wing mainframe...')
        try {
          const s = await getUserStats()
          if (lower === 'whoami') {
            print(
              `@${s.username} (${s.displayName})\n  events created : ${s.eventsCreated}\n  matches played : ${s.matchesPlayed} (W${s.wins}/L${s.losses})\n  win rate       : ${s.winRate}%\n  net position   : ${s.netDebt >= 0 ? '+' : ''}₹${s.netDebt.toLocaleString('en-IN')}`,
            )
          } else {
            print(
              `═══ ALPHA REPORT: @${s.username} ═══\n  POSITION SIZE  : ${s.matchesPlayed} contracts\n  WIN RATE       : ${s.winRate}% ${s.winRate >= 50 ? '▲ OUTPERFORM' : '▼ UNDERPERFORM'}\n  REALIZED PnL   : ${s.netDebt >= 0 ? '+' : ''}₹${s.netDebt.toLocaleString('en-IN')}\n  EVENTS ISSUED  : ${s.eventsCreated}\n  RATING         : ${s.winRate >= 60 ? 'STRONG BUY' : s.winRate >= 40 ? 'HOLD' : 'SELL (obviously)'}`,
            )
          }
        } catch {
          print('mainframe timeout. try again.', 'error')
        }
      } else if (lower.startsWith('cat anomaly/')) {
        const name = cmd.slice('cat anomaly/'.length).trim()
        if (!name) {
          print('usage: cat anomaly/<name>', 'error')
        } else {
          print(`decrypting anomaly file for '${name}'...`)
          try {
            const leak = await getLeakForMember(name)
            if (leak) {
              print(`── ${leak.title} [${leak.rarity.toUpperCase()}] ──\n${leak.body}`)
            } else {
              print(`cat: anomaly/${name}: no anomalies on record (suspicious in itself)`, 'error')
            }
          } catch {
            print('decryption failed.', 'error')
          }
        }
      } else if (lower.startsWith('add_lore ')) {
        const parts = cmd.split(' ')
        if (parts.length < 3) {
          print('usage: add_lore <member_name> <lore_text>', 'error')
        } else {
          const name = parts[1]
          const text = parts.slice(2).join(' ')
          print(`saving intel for ${name}...`)
          try {
            await addLore(name, text)
            print(`intel secured.`)
          } catch {
            print(`failed to secure intel.`, 'error')
          }
        }
      } else {
        print(`querying Wing AI...`)
        try {
          const aiResponse = await queryWingAI(cmd)
          print(`\n${aiResponse}\n`, 'output')
        } catch (e: any) {
          print(`Wing AI error: ${e.message}`, 'error')
          print(`command not found: ${cmd}. type 'help'.`, 'error')
        }
      }
    },
    [],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm md:items-center">
      <div className="flex h-[70vh] w-full max-w-2xl flex-col border border-profit/40 bg-card">
        <div className="flex items-center justify-between border-b border-chalk-faded px-3 py-2">
          <p className="font-display text-profit text-sm tracking-widest">
            THE 4AM DEVELOPER CONSOLE
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-chalk-dust hover:text-chalk-bright"
          >
            {'[ESC] close'}
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-xs leading-relaxed">
          {lines.map((l, i) => (
            <pre
              key={i}
              className={`whitespace-pre-wrap font-mono ${
                l.kind === 'input'
                  ? 'text-supernova'
                  : l.kind === 'error'
                    ? 'text-loss'
                    : 'text-chalk-bright'
              }`}
            >
              {parseTerminalText(l.text)}
            </pre>
          ))}
        </div>
        <form
          className="flex items-center gap-2 border-t border-chalk-faded px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = input
            setInput('')
            run(v)
          }}
        >
          <span className="text-profit text-xs">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent font-mono text-xs text-chalk-bright outline-none"
            placeholder="type a command..."
            aria-label="Terminal command input"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </div>
    </div>
  )
}
