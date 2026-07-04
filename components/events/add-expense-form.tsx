'use client'

import { useState, useTransition } from 'react'
import { addExpense } from '@/lib/actions/expenses'
import { toast as terminalToast } from '@/components/terminal-toast'
import { CandlestickButton } from '@/components/candlestick-button'

interface Member {
  id: string
  username: string
  displayName: string
}

type SplitMode = 'equal' | 'unequal' | 'percentage'

export function AddExpenseForm({
  eventId,
  members,
  currentUserId,
}: {
  eventId: string
  members: Member[]
  currentUserId: string
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(currentUserId)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [pending, startTransition] = useTransition()

  // State to hold the split inputs
  const [splits, setSplits] = useState<
    Record<string, { selected: boolean; value: string }>
  >(() => {
    const initial: Record<string, { selected: boolean; value: string }> = {}
    members.forEach((m) => {
      initial[m.id] = { selected: m.id === currentUserId, value: '' }
    })
    return initial
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] text-loss border border-loss/30 px-1.5 py-0.5 rounded hover:bg-loss/10 ml-2 mt-1 inline-block"
      >
        + EXPENSE
      </button>
    )
  }

  const handleToggleMember = (id: string, checked: boolean) => {
    setSplits((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: checked },
    }))
  }

  const handleValueChange = (id: string, val: string) => {
    setSplits((prev) => ({
      ...prev,
      [id]: { ...prev[id], value: val, selected: true },
    }))
  }

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault()
    const total = parseFloat(amount)
    if (!title.trim() || isNaN(total) || total <= 0) {
      return terminalToast('Invalid total amount.', 'error')
    }

    let finalSplits: { userId: string; amount: number }[] = []

    if (splitMode === 'equal') {
      const involved = Object.entries(splits)
        .filter(([, data]) => data.selected)
        .map(([id]) => id)
      
      if (involved.length === 0) {
        return terminalToast('Select at least one person.', 'error')
      }
      
      const perPerson = total / involved.length
      finalSplits = involved.map((id) => ({
        userId: id,
        amount: perPerson,
      }))
    } else if (splitMode === 'unequal') {
      let sum = 0
      for (const m of members) {
        const val = parseFloat(splits[m.id]?.value || '0')
        if (val > 0) {
          finalSplits.push({ userId: m.id, amount: val })
          sum += val
        }
      }
      if (Math.abs(sum - total) > 0.01) {
        return terminalToast(`Split sum (₹${sum.toFixed(2)}) must equal total (₹${total.toFixed(2)})`, 'error')
      }
    } else if (splitMode === 'percentage') {
      let percentSum = 0
      for (const m of members) {
        const p = parseFloat(splits[m.id]?.value || '0')
        if (p > 0) {
          const amt = (p / 100) * total
          finalSplits.push({ userId: m.id, amount: amt })
          percentSum += p
        }
      }
      if (Math.abs(percentSum - 100) > 0.01) {
        return terminalToast(`Percentages must add up to 100% (currently ${percentSum}%)`, 'error')
      }
    }

    startTransition(async () => {
      try {
        await addExpense({
          title,
          totalAmount: total,
          paidBy,
          eventId,
          splits: finalSplits,
        })
        setOpen(false)
        setTitle('')
        setAmount('')
        terminalToast('Expense logged successfully.', 'success')
      } catch (err: any) {
        terminalToast(err.message || 'Failed to log expense.', 'error')
      }
    })
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded border border-loss/40 bg-card p-4 shadow-sm"
      onSubmit={submitExpense}
    >
      <div className="flex items-center justify-between border-b border-loss/20 pb-2">
        <p className="font-mono text-xs font-bold text-loss">ADVANCED_SETTLEMENT</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          [CLOSE]
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What was this for?"
          className="flex-1 rounded border border-input bg-background px-3 py-2 font-mono text-xs focus:border-loss focus:outline-none focus:ring-1 focus:ring-loss/50"
          required
        />
        <div className="relative w-full sm:w-32">
          <span className="absolute left-3 top-2 text-muted-foreground font-mono text-xs">₹</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            type="number"
            step="0.01"
            className="w-full rounded border border-input bg-background pl-6 pr-3 py-2 font-mono text-xs text-loss focus:border-loss focus:outline-none focus:ring-1 focus:ring-loss/50"
            required
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="font-mono text-[10px] text-muted-foreground w-16">Paid by:</label>
        <select
          value={paidBy}
          onChange={(e) => setPaidBy(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1 font-mono text-xs max-w-full"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === currentUserId ? 'You' : m.username}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] text-muted-foreground w-16">Split by:</label>
        <div className="flex gap-1 flex-wrap">
          {(['equal', 'unequal', 'percentage'] as SplitMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSplitMode(mode)}
              className={`rounded px-2 py-1 font-mono text-[10px] transition-colors ${
                splitMode === mode
                  ? 'bg-loss/20 text-loss border border-loss/50'
                  : 'bg-background border border-border text-muted-foreground hover:bg-accent/10 hover:text-accent'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border bg-background/50 p-2">
        <div className="flex flex-col gap-1">
          {members.map((m) => {
            const data = splits[m.id] || { selected: false, value: '' }
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between p-1 hover:bg-card">
                <label className="flex flex-1 items-center gap-2 cursor-pointer">
                  {splitMode === 'equal' && (
                    <input
                      type="checkbox"
                      checked={data.selected}
                      onChange={(e) => handleToggleMember(m.id, e.target.checked)}
                      className="accent-loss"
                    />
                  )}
                  <span className={`font-mono text-xs ${m.id === currentUserId ? 'text-accent' : 'text-foreground'}`}>
                    {m.id === currentUserId ? 'You' : m.username}
                  </span>
                </label>
                
                {splitMode === 'equal' && data.selected && amount && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ~₹{(parseFloat(amount) / Object.values(splits).filter(s => s.selected).length).toFixed(2)}
                  </span>
                )}

                {splitMode === 'unequal' && (
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5 text-muted-foreground font-mono text-[10px]">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={data.value}
                      onChange={(e) => handleValueChange(m.id, e.target.value)}
                      className="w-full rounded border border-input bg-background pl-5 pr-2 py-1 font-mono text-xs focus:border-loss focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                )}

                {splitMode === 'percentage' && (
                  <div className="relative w-20">
                    <span className="absolute right-2 top-1.5 text-muted-foreground font-mono text-[10px]">%</span>
                    <input
                      type="number"
                      step="0.1"
                      value={data.value}
                      onChange={(e) => handleValueChange(m.id, e.target.value)}
                      className="w-full rounded border border-input bg-background px-2 py-1 font-mono text-xs focus:border-loss focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <CandlestickButton
          type="submit"
          isLoading={pending}
          className="!border-loss !text-loss hover:!bg-loss/10 px-4 py-2"
        >
          {pending ? 'PROCESSING...' : 'COMMIT_EXPENSE'}
        </CandlestickButton>
      </div>
    </form>
  )
}
