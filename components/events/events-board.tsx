'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AddExpenseForm } from './add-expense-form'
import { InlineConfirmButton } from '@/components/inline-confirm-button'
import {
  createEvent,
  deleteEvent,
  setRsvp,
  createPoll,
  votePoll,
  addMicroEvent,
  updateEvent,
  toggleEventPin,
  blastEventToWing,
} from '@/lib/actions/events'
import { addExpense, deleteExpense } from '@/lib/actions/expenses'
import { saveVaultMedia } from '@/lib/actions/vault'
import { blastPollToWing } from '@/lib/actions/polls'
import { CldUploadWidget } from 'next-cloudinary'
import { toast as terminalToast } from '@/components/terminal-toast'
import { cn } from '@/lib/utils'

// ─── Types (serialized from server) ───
interface Member {
  id: string
  username: string
  displayName: string
}
interface Rsvp {
  id: string
  status: 'long' | 'short' | 'hedge'
  userId: string
  user: Member
}
interface PollOption {
  id: string
  label: string
  votes: { id: string; userId: string; user: Member }[]
}
interface Poll {
  id: string
  question: string
  isAnonymous?: boolean
  options: PollOption[]
}
interface WingEvent {
  id: string
  title: string
  description: string | null
  category: 'treat' | 'dinner' | 'game' | 'outing' | 'trip'
  location: string
  locationCustom: string | null
  startsAt: string | null
  isLive: boolean
  whatsappBlasted: boolean
  createdBy: string
  creator: Member
  rsvps: Rsvp[]
  microEvents: {
    id: string
    title: string
    location: string
    locationCustom: string | null
    expenses: any[]
  }[]
  polls: Poll[]
  expenses: any[]
  isPinned?: boolean
}

const LOCATION_LABELS: Record<string, string> = {
  rehdi: 'Rehdi',
  c_not: 'C-Not',
  fm: 'FM',
  '301': 'Room 301',
  looters: 'Looters',
  dominos: "Domino's",
  outside_campus: 'Outside Campus',
  other: 'Other',
}

const CATEGORY_TICKERS: Record<string, string> = {
  treat: '$TREAT',
  dinner: '$DINNER',
  game: '$GAME',
  outing: '$OUTING',
  trip: '$TRIP',
}

function buildWhatsAppLink(e: WingEvent) {
  const loc = e.location === 'other' ? e.locationCustom ?? 'TBD' : LOCATION_LABELS[e.location]
  const when = e.startsAt
    ? new Date(e.startsAt).toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'TBD'
  const longs = e.rsvps.filter((r) => r.status === 'long').map((r) => r.user.displayName)
  const text = [
    `📈 ${CATEGORY_TICKERS[e.category]} ALERT — ${e.title}`,
    ``,
    `📍 ${loc}`,
    `🕐 ${when}`,
    e.description ? `📝 ${e.description}` : '',
    longs.length ? `✅ Going long: ${longs.join(', ')}` : '',
    ``,
    `RSVP on the Saturo terminal. This position will not wait for you.`,
  ]
    .filter(Boolean)
    .join('\n')
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

// ─── RSVP row ───
function RsvpControls({ event, currentUserId }: { event: WingEvent; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const mine = event.rsvps.find((r) => r.userId === currentUserId)?.status

  const buttons: { status: 'long' | 'short' | 'hedge'; label: string; cls: string }[] = [
    { status: 'long', label: 'LONG', cls: 'text-profit border-profit/60' },
    { status: 'short', label: 'SHORT', cls: 'text-loss border-loss/60' },
    { status: 'hedge', label: 'HEDGE', cls: 'text-accent border-accent/60' },
  ]

  return (
    <div className="flex items-center gap-2" role="group" aria-label="RSVP">
      {buttons.map((b) => (
        <button
          key={b.status}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setRsvp(event.id, b.status)
              terminalToast(
                b.status === 'long'
                  ? `Position opened: LONG ${CATEGORY_TICKERS[event.category]}`
                  : b.status === 'short'
                    ? `Position exited. Weak hands detected.`
                    : `Hedged. Commitment issues noted.`,
              )
            })
          }
          className={cn(
            'rounded border px-3 py-1 font-mono text-xs transition-all',
            mine === b.status
              ? `${b.cls} bg-card`
              : 'border-border text-muted-foreground hover:border-foreground/50',
            pending && 'opacity-50',
          )}
          aria-pressed={mine === b.status}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

// ─── Poll block ───
function PollBlock({ poll, currentUserId }: { poll: Poll; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const totalVotes = poll.options.reduce((s, o) => s + o.votes.length, 0)

  return (
    <div className="mt-3 rounded border border-border/60 bg-background/40 p-3">
      <div className="flex justify-between items-start gap-2">
        <p className="font-mono text-xs text-accent">
          [SURVEY] {poll.question}
          {poll.isAnonymous && <span className="ml-2 text-[10px] text-muted-foreground">[anonymous]</span>}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              try {
                await blastPollToWing(poll.id)
                terminalToast('Survey blast sent to all operators.')
              } catch (e: any) {
                terminalToast(e.message, 'error')
              }
            })
          }}
          className="font-mono text-xs text-muted-foreground hover:text-profit transition-colors shrink-0"
          title="Blast Survey"
        >
          [🚀 blast]
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes ? Math.round((opt.votes.length / totalVotes) * 100) : 0
          const voted = opt.votes.some((v) => v.userId === currentUserId)
          return (
            <div key={opt.id} className="relative">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => votePoll(poll.id, opt.id))}
                className={cn(
                  'relative flex w-full justify-between gap-2 overflow-hidden rounded border px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  voted ? 'border-primary text-primary' : 'border-border/60 text-foreground/80 hover:border-foreground/40',
                )}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/15"
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
                <span className="relative z-10">{opt.label}</span>
                <span className="relative z-10 text-muted-foreground">
                  {opt.votes.length} ({pct}%)
                </span>
              </button>
              {!poll.isAnonymous && opt.votes.length > 0 && (
                <div className="z-10 relative px-2 py-1 flex flex-wrap gap-1">
                  {opt.votes.map((v, idx) => (
                    <span key={idx} className="text-[10px] text-muted-foreground/80 font-mono">
                      @{v.user?.username || v.userId}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Add poll inline form ───
function AddPollForm({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
      >
        + open_market_survey (poll)
      </button>
    )
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded border border-border/60 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!question.trim() || options.filter((o) => o.trim()).length < 2) {
          terminalToast('A survey needs a question and 2+ options.', 'error')
          return
        }
        startTransition(async () => {
          await createPoll(eventId, question, options, isAnonymous)
          setOpen(false)
          setQuestion('')
          setOptions(['', ''])
          setIsAnonymous(false)
          terminalToast('Market survey deployed.')
        })
      }}
    >
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="poll question, e.g. which rehdi?"
        className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
        aria-label="Poll question"
      />
      {options.map((opt, i) => (
        <input
          key={i}
          value={opt}
          onChange={(e) => {
            const newOptions = [...options]
            newOptions[i] = e.target.value
            if (i === options.length - 1 && e.target.value.trim() !== '') {
              newOptions.push('')
            }
            setOptions(newOptions)
          }}
          placeholder={`option ${i + 1}`}
          className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
          aria-label={`Poll option ${i + 1}`}
        />
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOptions((p) => [...p, ''])}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          + option
        </button>
        <div className="flex items-center gap-1.5 ml-2">
          <input 
            type="checkbox" 
            id={`isAnonymous-${eventId}`}
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="accent-accent w-3 h-3"
          />
          <label htmlFor={`isAnonymous-${eventId}`} className="font-mono text-[10px] text-muted-foreground select-none cursor-pointer hover:text-foreground">
            anonymous
          </label>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-xs text-muted-foreground"
          >
            cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-primary px-3 py-1 font-mono text-xs text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'deploying...' : 'deploy'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ─── Add MicroEvent Form ───
function AddMicroEventForm({ parentEventId }: { parentEventId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('rehdi')
  const [pending, startTransition] = useTransition()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 font-mono text-[10px] text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
      >
        + add_sub_position
      </button>
    )
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded border border-border/60 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return terminalToast('Needs a title.', 'error')
        startTransition(async () => {
          await addMicroEvent(parentEventId, { title, location })
          setOpen(false)
          setTitle('')
          terminalToast('Sub position added.')
        })
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="micro event title"
        className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
        required
      />
      <select
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
      >
        {Object.entries(LOCATION_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground text-xs font-mono">cancel</button>
        <button type="submit" disabled={pending} className="text-primary text-xs font-mono bg-primary/20 px-2 py-1 rounded">add</button>
      </div>
    </form>
  )
}

function ExpenseList({ expenses, members, currentUserId }: { expenses: any[]; members: Member[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  if (!expenses?.length) return null
  
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {expenses.map((ex) => {
        if (editingExpenseId === ex.id) {
          return (
            <div key={ex.id} className="my-1 rounded border border-loss/40 bg-card p-3 shadow-sm max-w-full overflow-x-auto">
              <AddExpenseForm
                eventId={ex.eventId}
                members={members}
                currentUserId={currentUserId}
                initialExpense={ex}
                onCancel={() => setEditingExpenseId(null)}
              />
            </div>
          )
        }
        return (
          <li key={ex.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-border/40 bg-card/50 px-2 py-1 font-mono text-xs">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-foreground truncate">{ex.title} <span className="text-muted-foreground">by</span> @{ex.payer.username}</span>
              <span className="text-loss font-bold">₹{ex.totalAmount.toLocaleString('en-IN')}</span>
            </span>
            {ex.paidBy === currentUserId && (
              <div className="flex shrink-0 items-center gap-2 mt-1 sm:mt-0">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditingExpenseId(ex.id)}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  [edit]
                </button>
                <InlineConfirmButton
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await deleteExpense(ex.id)
                        terminalToast('Expense voided.')
                      } catch (e: any) {
                        terminalToast(e.message, 'error')
                      }
                    })
                  }}
                  idleLabel="[del]"
                  confirmLabel="[CONFIRM_VOID?]"
                  idleClassName="text-muted-foreground hover:text-destructive"
                  confirmClassName="text-destructive font-bold"
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ─── Event card ───
export function EventCard({ event, members, currentUserId, isTripDesk = false }: { event: WingEvent; members: Member[]; currentUserId: string; isTripDesk?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const isLive =
    event.startsAt &&
    new Date(event.startsAt) <= new Date() &&
    new Date(event.startsAt).getTime() > Date.now() - 1000 * 60 * 60 * 6

  const longs = event.rsvps.filter((r) => r.status === 'long')
  const shorts = event.rsvps.filter((r) => r.status === 'short')
  const hedges = event.rsvps.filter((r) => r.status === 'hedge')

  return (
    <article
      className={cn(
        'rounded border bg-card p-4',
        isLive ? 'animate-pulse-gold border-accent' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-accent">
              {CATEGORY_TICKERS[event.category]}
            </span>
            {isLive && (
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-foreground">
                LIVE
              </span>
            )}
            {event.whatsappBlasted && (
              <span className="rounded border border-profit/50 px-1.5 py-0.5 font-mono text-[10px] text-profit">
                BLASTED
              </span>
            )}
          </div>
          <h3 className="mt-1 font-mono text-lg font-bold text-balance">{event.title}</h3>
          <p className="font-mono text-xs text-muted-foreground">
            📍 {event.location === 'other' ? event.locationCustom : LOCATION_LABELS[event.location]}
            {event.startsAt &&
              ` · ${new Date(event.startsAt).toLocaleString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}`}
            {' · by @'}
            {event.creator.username}
          </p>
          {event.description && (
            <p className="mt-2 font-mono text-sm text-foreground/85 text-pretty">{event.description}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1 items-end self-start">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await toggleEventPin(event.id)
                  terminalToast(event.isPinned ? 'Position removed from watchlist.' : 'Position added to watchlist.')
                } catch (e: any) {
                  terminalToast(e.message, 'error')
                }
              })
            }}
            className="font-mono text-xs text-muted-foreground hover:text-warning"
          >
            {event.isPinned ? '[📌 unwatch]' : '[📌 watch]'}
          </button>
          
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const res = await blastEventToWing(event.id)
                  if (res && res.success) {
                    terminalToast(`Blast sent to ${res.count} operators.`)
                  } else {
                    terminalToast(res?.error || 'Blast failed.', 'error')
                  }
                } catch (e: any) {
                  terminalToast(e.message || 'Blast failed.', 'error')
                }
              })
            }}
            className="font-mono text-xs text-muted-foreground hover:text-profit transition-colors"
            title="Blast Event"
          >
            [🚀 blast]
          </button>

          {event.createdBy === currentUserId && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(!editing)}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                [edit]
              </button>
              <InlineConfirmButton
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await deleteEvent(event.id)
                    terminalToast('Position liquidated.', 'error')
                  })
                }}
                idleLabel="[liquidate]"
                confirmLabel="[CONFIRM_LIQUIDATE?]"
                idleClassName="text-muted-foreground hover:text-destructive"
                confirmClassName="text-destructive font-bold"
              />
              <InlineConfirmButton
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await archiveEvent(event.id)
                    terminalToast('Position vaulted.', 'success')
                  })
                }}
                idleLabel="[liquidate & vault]"
                confirmLabel="[CONFIRM_VAULT?]"
                idleClassName="font-mono text-xs text-muted-foreground hover:text-profit"
                confirmClassName="text-profit font-bold"
              />
            </>
          )}
        </div>
      </div>

      {editing && (
        <form
          className="mt-4 rounded border border-primary/50 bg-card p-3 mb-4"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const title = String(fd.get('title') ?? '').trim()
            if (!title) {
              terminalToast('A position needs a name.', 'error')
              return
            }
            startTransition(async () => {
              try {
                await updateEvent(event.id, {
                  title,
                  description: String(fd.get('description') ?? ''),
                  category: String(fd.get('category')) as WingEvent['category'],
                  location: String(fd.get('location')),
                  locationCustom: String(fd.get('locationCustom') ?? ''),
                  startsAt: String(fd.get('startsAt') ?? '') || undefined,
                })
                terminalToast('Position revised.')
                setEditing(false)
              } catch (e: any) {
                terminalToast(e.message, 'error')
              }
            })
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-muted-foreground">title</span>
              <input name="title" defaultValue={event.title} required className="rounded border border-input bg-background px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-muted-foreground">category</span>
              <select name="category" defaultValue={event.category} className="rounded border border-input bg-background px-2 py-1.5">
                <option value="treat">treat</option>
                <option value="dinner">dinner</option>
                <option value="game">game night</option>
                <option value="outing">outing</option>
                <option value="trip">trip</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-muted-foreground">location</span>
              <select name="location" defaultValue={event.location} className="rounded border border-input bg-background px-2 py-1.5">
                {Object.entries(LOCATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-muted-foreground">custom location (if other)</span>
              <input name="locationCustom" defaultValue={event.locationCustom || ''} className="rounded border border-input bg-background px-2 py-1.5" />
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs">
              <span className="text-muted-foreground">starts at</span>
              <input 
                name="startsAt" 
                type="datetime-local" 
                defaultValue={event.startsAt ? new Date(new Date(event.startsAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                className="rounded border border-input bg-background px-2 py-1.5" 
              />
            </label>
            <label className="flex flex-col gap-1 font-mono text-xs sm:col-span-2">
              <span className="text-muted-foreground">description</span>
              <textarea name="description" rows={2} defaultValue={event.description || ''} className="rounded border border-input bg-background px-2 py-1.5" />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setEditing(false)} className="font-mono text-xs text-muted-foreground hover:text-foreground">abort</button>
            <button type="submit" disabled={pending} className="rounded bg-primary px-3 py-1 font-mono text-xs text-primary-foreground disabled:opacity-50">
              {pending ? 'SAVING...' : 'SAVE_CHANGES'}
            </button>
          </div>
        </form>
      )}

      {(event.category === 'trip' || event.category === 'outing') && !isTripDesk && (
        <div className="mt-4 border-t border-border/40 pt-4">
          <Link
            href={`/hub/events/${event.id}`}
            className="group flex items-center justify-between gap-2 rounded border border-accent/40 bg-accent/5 p-3 hover:bg-accent/10 transition-colors"
          >
            <span className="font-mono text-sm text-accent font-bold tracking-widest break-words">
              [ENTER_TRIP_DESK]
            </span>
            <span className="font-mono text-xs text-muted-foreground group-hover:text-accent transition-colors shrink-0 whitespace-nowrap text-right">
              {event.microEvents?.length || 0} sub-positions →
            </span>
          </Link>
          <div className="mt-2 flex flex-col gap-1 px-1">
            {event.microEvents?.map(micro => (
              <div key={micro.id} className="flex justify-between items-center bg-card/50 p-2 rounded border border-border/40">
                <span className="font-mono text-[10px] text-foreground">{micro.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const res = await blastEventToWing(micro.id)
                        if (res && res.success) {
                          terminalToast(`Blast sent to ${res.count} operators.`)
                        } else {
                          terminalToast(res?.error || 'Blast failed.', 'error')
                        }
                      } catch (e: any) {
                        terminalToast(e.message || 'Blast failed.', 'error')
                      }
                    })
                  }}
                  className="font-mono text-xs text-muted-foreground hover:text-profit transition-colors"
                  title="Blast Microevent"
                >
                  [🚀 blast]
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 items-start">
        <details className="group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase text-accent border border-accent/30 bg-accent/5 px-2 py-1 rounded hover:bg-accent/10 select-none inline-block">
            <span className="group-open:hidden">[+]</span><span className="hidden group-open:inline">[−]</span> EXPENSES ({event.expenses?.length || 0})
          </summary>
          <div className="mt-2 flex flex-col gap-2 rounded border border-border/40 bg-card/40 p-3 min-w-[250px] max-w-[100vw] overflow-x-auto">
            <AddExpenseForm eventId={event.id} members={members} currentUserId={currentUserId} />
            <ExpenseList expenses={event.expenses} members={members} currentUserId={currentUserId} />
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer font-mono text-[10px] uppercase text-profit border border-profit/30 bg-profit/5 px-2 py-1 rounded hover:bg-profit/10 select-none inline-block">
            <span className="group-open:hidden">[+]</span><span className="hidden group-open:inline">[−]</span> VAULT MEDIA
          </summary>
          <div className="mt-2 rounded border border-border/40 bg-card/40 p-3">
            <CldUploadWidget
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? `preset_${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}` : undefined}
              onSuccess={async (result: any) => {
                if (result.info && result.info.secure_url) {
                  await saveVaultMedia({
                    cloudinaryUrl: result.info.secure_url,
                    cloudinaryPublicId: result.info.public_id,
                    mediaType: result.info.resource_type === 'video' ? 'video' : 'image',
                    eventId: event.id
                  });
                  terminalToast('Media uploaded to vault.', 'success');
                }
              }}
            >
              {({ open }) => (
                <button
                  type="button"
                  onClick={() => open()}
                  className="font-mono text-[10px] text-profit border border-profit/30 px-2 py-1 rounded hover:bg-profit/10 select-none"
                >
                  + UPLOAD_MEDIA
                </button>
              )}
            </CldUploadWidget>
          </div>
        </details>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <RsvpControls event={event} currentUserId={currentUserId} />
      </div>

      {(longs.length > 0 || shorts.length > 0 || hedges.length > 0) && (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          {longs.length > 0 && (
            <span className="text-profit">
              LONG[{longs.map((r) => r.user.username).join(', ')}]{' '}
            </span>
          )}
          {shorts.length > 0 && (
            <span className="text-loss">
              SHORT[{shorts.map((r) => r.user.username).join(', ')}]{' '}
            </span>
          )}
          {hedges.length > 0 && (
            <span className="text-accent">HEDGE[{hedges.map((r) => r.user.username).join(', ')}]</span>
          )}
        </p>
      )}

      {event.polls.map((poll) => (
        <PollBlock key={poll.id} poll={poll} currentUserId={currentUserId} />
      ))}
      <AddPollForm eventId={event.id} />
    </article>
  )
}

// ─── Create event form ───
function CreateEventForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [category, setCategory] = useState<WingEvent['category']>('treat')
  const [micro, setMicro] = useState<{ title: string; location: string }[]>([])

  return (
    <form
      className="rounded border border-primary/50 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const title = String(fd.get('title') ?? '').trim()
        if (!title) {
          terminalToast('A position needs a name.', 'error')
          return
        }
        startTransition(async () => {
          await createEvent({
            title,
            description: String(fd.get('description') ?? ''),
            category,
            location: String(fd.get('location')) as WingEvent['location'] & string as never,
            locationCustom: String(fd.get('locationCustom') ?? ''),
            startsAt: String(fd.get('startsAt') ?? '') || undefined,
            microEvents: micro.map((m) => ({ title: m.title, location: m.location })),
          })
          terminalToast('Position deployed to the floor.')
          onClose()
          router.refresh()
        })
      }}
    >
      <h3 className="font-mono text-sm font-bold text-primary">OPEN_NEW_POSITION</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">title</span>
          <input
            name="title"
            required
            placeholder="LKG owes us a treat"
            className="rounded border border-input bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">category</span>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as WingEvent['category'])}
            className="rounded border border-input bg-background px-2 py-1.5"
          >
            <option value="treat">treat</option>
            <option value="dinner">dinner</option>
            <option value="game">game night</option>
            <option value="outing">outing</option>
            <option value="trip">trip</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">location</span>
          <select
            name="location"
            defaultValue="rehdi"
            className="rounded border border-input bg-background px-2 py-1.5"
          >
            <option value="rehdi">Rehdi</option>
            <option value="c_not">C-Not</option>
            <option value="fm">FM</option>
            <option value="301">Room 301</option>
            <option value="looters">Looters</option>
            <option value="dominos">Domino&apos;s</option>
            <option value="outside_campus">Outside Campus</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">custom location (if other)</span>
          <input
            name="locationCustom"
            placeholder="e.g. that one dhaba"
            className="rounded border border-input bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">starts at</span>
          <input
            name="startsAt"
            type="datetime-local"
            className="rounded border border-input bg-background px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs sm:col-span-2">
          <span className="text-muted-foreground">description</span>
          <textarea
            name="description"
            rows={2}
            placeholder="context, stakes, who's paying..."
            className="rounded border border-input bg-background px-2 py-1.5"
          />
        </label>
      </div>

      {(category === 'outing' || category === 'trip') && (
        <div className="mt-3 border-l-2 border-primary/40 pl-3">
          <p className="font-mono text-xs text-muted-foreground">
            sub_positions (micro-events within this {category})
          </p>
          {micro.map((m, i) => (
            <div key={i} className="mt-2 flex gap-2">
              <input
                value={m.title}
                onChange={(e) =>
                  setMicro((prev) => prev.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)))
                }
                placeholder={`micro-event ${i + 1}`}
                className="flex-1 rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
                aria-label={`Micro-event ${i + 1} title`}
              />
              <select
                value={m.location}
                onChange={(e) =>
                  setMicro((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, location: e.target.value } : p)),
                  )
                }
                className="rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
                aria-label={`Micro-event ${i + 1} location`}
              >
                <option value="rehdi">Rehdi</option>
                <option value="c_not">C-Not</option>
                <option value="fm">FM</option>
                <option value="301">301</option>
                <option value="looters">Looters</option>
                <option value="dominos">Domino&apos;s</option>
                <option value="outside_campus">Outside</option>
                <option value="other">Other</option>
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMicro((p) => [...p, { title: '', location: 'rehdi' }])}
            className="mt-2 font-mono text-xs text-accent hover:underline"
          >
            + add micro-event
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          abort
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-3 py-1 font-mono text-xs text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'DEPLOYING...' : 'DEPLOY_POSITION'}
        </button>
      </div>
    </form>
  )
}

// ─── Board ───
export function EventsBoard({
  events,
  members,
  currentUserId,
}: {
  events: WingEvent[]
  members: Member[]
  currentUserId: string
}) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <CreateEventForm onClose={() => setCreating(false)} />
      ) : (
        <div>
          <button 
            onClick={() => setCreating(true)}
            className="rounded border border-primary px-4 py-2 font-mono text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
          >
            + OPEN_NEW_POSITION
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="rounded border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
          No open positions. The floor is dead. Deploy something.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} members={members} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  )
}
