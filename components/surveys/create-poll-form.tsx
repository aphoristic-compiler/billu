'use client'

import { useState, useTransition, useRef } from 'react'
import { createStandalonePoll } from '@/lib/actions/polls'
import { toast } from '@/components/terminal-toast'

export function CreatePollForm() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const [options, setOptions] = useState(['', '', '', ''])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-start font-mono text-xs text-accent border border-accent/40 bg-accent/5 px-3 py-2 rounded hover:bg-accent/10 transition-colors"
      >
        + INITIALIZE_MARKET_SURVEY
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const question = formData.get('question') as string
        const optionsList = Array.from(formData.keys())
          .filter(k => k.startsWith('option_'))
          .map(k => formData.get(k) as string)
          .filter(v => v.trim() !== '')
        const isAnonymous = formData.get('isAnonymous') === 'on'
          
        startTransition(async () => {
          try {
            await createStandalonePoll(question, optionsList, isAnonymous)
            setOpen(false)
            setOptions(['', '', '', ''])
            toast('Survey deployed.', 'success')
          } catch (e: any) {
            toast(e.message, 'error')
          }
        })
      }}
      className="flex flex-col gap-3 rounded border border-accent/40 bg-card/40 p-4 max-w-md"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-mono text-sm text-accent">NEW_SURVEY</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground font-mono text-xs">
          [cancel]
        </button>
      </div>

      <input
        name="question"
        type="text"
        required
        placeholder="Question (e.g. Next wing destination?)"
        className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
      />
      
      <div className="space-y-2">
        {options.map((opt, i) => (
          <input
            key={i}
            name={`option_${i}`}
            type="text"
            value={opt}
            onChange={(e) => {
              const newOptions = [...options]
              newOptions[i] = e.target.value
              if (i === options.length - 1 && e.target.value.trim() !== '') {
                newOptions.push('')
              }
              setOptions(newOptions)
            }}
            placeholder={`Option ${i + 1}${i >= 2 ? ' (optional)' : ''}`}
            required={i < 2}
            className="w-full rounded border border-border bg-background px-3 py-1 font-mono text-xs focus:border-accent focus:outline-none"
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-1">
        <input 
          type="checkbox" 
          id="isAnonymous" 
          name="isAnonymous" 
          className="accent-accent"
        />
        <label htmlFor="isAnonymous" className="font-mono text-xs text-muted-foreground select-none cursor-pointer hover:text-foreground">
          Anonymous Survey (hides voters)
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-accent px-4 py-2 font-mono text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
      >
        {pending ? 'DEPLOYING...' : 'DEPLOY_SURVEY'}
      </button>
    </form>
  )
}
