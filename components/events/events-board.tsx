'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createEvent,
  deleteEvent,
  setRsvp,
  createPoll,
  votePoll,
} from '@/lib/actions/events'
import { CandlestickButton } from '@/components/candlestick-button'
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
  microEvents: { id: string; title: string; location: string; locationCustom: string | null }[]
  polls: Poll[]
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
      <p className="font-mono text-xs text-accent">[SURVEY] {poll.question}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes ? Math.round((opt.votes.length / totalVotes) * 100) : 0
          const voted = opt.votes.some((v) => v.userId === currentUserId)
          return (
            <button
              key={opt.id}
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => votePoll(poll.id, opt.id))}
              className={cn(
                'relative overflow-hidden rounded border px-2 py-1.5 text-left font-mono text-xs transition-colors',
                voted ? 'border-primary text-primary' : 'border-border/60 text-foreground/80 hover:border-foreground/40',
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
              <span className="relative flex justify-between gap-2">
                <span>{opt.label}</span>
                <span className="text-muted-foreground">
                  {opt.votes.length} ({pct}%)
                </span>
              </span>
            </button>
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
          await createPoll(eventId, question, options)
          setOpen(false)
          setQuestion('')
          setOptions(['', ''])
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
          onChange={(e) =>
            setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
          }
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

// ─── Event card ───
function EventCard({ event, currentUserId }: { event: WingEvent; currentUserId: string }) {
  const [pending, startTransition] = useTransition()
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
        {event.createdBy === currentUserId && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('Liquidate this position? This cannot be undone.')) return
              startTransition(async () => {
                await deleteEvent(event.id)
                terminalToast('Position liquidated.', 'error')
              })
            }}
            className="shrink-0 font-mono text-xs text-muted-foreground hover:text-destructive"
            aria-label={`Delete event ${event.title}`}
          >
            [liquidate]
          </button>
        )}
      </div>

      {event.microEvents.length > 0 && (
        <div className="mt-3 border-l-2 border-primary/40 pl-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            sub_positions
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {event.microEvents.map((m) => (
              <li key={m.id} className="font-mono text-xs text-foreground/80">
                └─ {m.title}{' '}
                <span className="text-muted-foreground">
                  ({m.location === 'other' ? m.locationCustom : LOCATION_LABELS[m.location]})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <RsvpControls event={event} currentUserId={currentUserId} />
        <a
          href={buildWhatsAppLink(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-profit/60 px-3 py-1 font-mono text-xs text-profit hover:bg-profit/10"
        >
          BLAST_TO_WHATSAPP →
        </a>
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
        <CandlestickButton type="submit" loading={pending}>
          DEPLOY_POSITION
        </CandlestickButton>
      </div>
    </form>
  )
}

// ─── Board ───
export function EventsBoard({
  events,
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
          <CandlestickButton onClick={() => setCreating(true)}>
            + OPEN_NEW_POSITION
          </CandlestickButton>
        </div>
      )}

      {events.length === 0 ? (
        <p className="rounded border border-dashed border-border p-8 text-center font-mono text-sm text-muted-foreground">
          No open positions. The floor is dead. Deploy something.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  )
}
