'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq, and, or } from 'drizzle-orm'
import { db, expenses, expenseSplits, debts, users } from '@/lib/db'
import { requireDbUser } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function addExpense(input: {
  title: string
  totalAmount: number
  paidBy: string
  tag?: string
  notes?: string
  eventId?: string
  isRecurring?: boolean
  recurringCron?: string
  splits: { userId: string; amount: number; shareRatio?: number }[]
}) {
  const user = await requireDbUser()

  const [expense] = await db
    .insert(expenses)
    .values({
      title: input.title,
      totalAmount: input.totalAmount,
      paidBy: input.paidBy,
      tag: input.tag || null,
      notes: input.notes || null,
      eventId: input.eventId || null,
      isRecurring: !!input.isRecurring,
      recurringCron: input.recurringCron || null,
    })
    .returning()

  await db.insert(expenseSplits).values(
    input.splits.map((s) => ({
      expenseId: expense.id,
      userId: s.userId,
      amount: s.amount,
      shareRatio: s.shareRatio ?? null,
    })),
  )

  // Everyone who owes a share (other than the payer) gets a pending debt
  await db.insert(debts).values(
    input.splits
      .filter((s) => s.userId !== input.paidBy && s.amount > 0)
      .map((s) => ({
        fromUser: s.userId,
        toUser: input.paidBy,
        amount: s.amount,
        expenseId: expense.id,
      })),
  )

  await logActivity(
    user.id,
    'expense_added',
    `[MARGIN] ₹${input.totalAmount.toLocaleString('en-IN')} exposure opened by @${user.username} — ${input.title}`,
  )

  revalidatePath('/hub')
  revalidatePath('/hub/ledger')
  return expense
}

export async function settleDebt(fromUserId: string, toUserId: string, amount: number) {
  const user = await requireDbUser()

  // Mark pending debts between the pair as settled up to `amount`
  const pending = await db
    .select()
    .from(debts)
    .where(
      and(eq(debts.fromUser, fromUserId), eq(debts.toUser, toUserId), eq(debts.status, 'pending')),
    )

  let remaining = amount
  for (const d of pending) {
    if (remaining <= 0) break
    if (d.amount <= remaining + 0.01) {
      await db
        .update(debts)
        .set({ status: 'settled', settledAt: new Date() })
        .where(eq(debts.id, d.id))
      remaining -= d.amount
    } else {
      // partial: settle this one, create remainder
      await db
        .update(debts)
        .set({ status: 'settled', settledAt: new Date(), amount: remaining })
        .where(eq(debts.id, d.id))
      await db.insert(debts).values({
        fromUser: fromUserId,
        toUser: toUserId,
        amount: d.amount - remaining,
        expenseId: d.expenseId,
      })
      remaining = 0
    }
  }

  const [from] = await db.select().from(users).where(eq(users.id, fromUserId)).limit(1)
  const [to] = await db.select().from(users).where(eq(users.id, toUserId)).limit(1)

  await logActivity(
    user.id,
    'debt_settled',
    `[LIQUIDATION] ₹${amount.toLocaleString('en-IN')} margin call met. @${from?.username} → @${to?.username}`,
  )

  revalidatePath('/hub')
  revalidatePath('/hub/ledger')
}

export async function getLedgerData() {
  const [allExpenses, pendingDebts, members] = await Promise.all([
    db.query.expenses.findMany({
      orderBy: [desc(expenses.createdAt)],
      with: { payer: true, splits: { with: { user: true } } },
    }),
    db.query.debts.findMany({
      where: eq(debts.status, 'pending'),
      with: { debtor: true, creditor: true },
    }),
    db.select().from(users).orderBy(users.username),
  ])
  return { expenses: allExpenses, debts: pendingDebts, members }
}

export type Settlement = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

/** Greedy debt simplification over all pending debts. */
export async function getSimplifiedSettlements(): Promise<Settlement[]> {
  const pending = await db.query.debts.findMany({
    where: eq(debts.status, 'pending'),
    with: { debtor: true, creditor: true },
  })

  const balance = new Map<string, { name: string; net: number }>()
  for (const d of pending) {
    const from = balance.get(d.fromUser) ?? { name: d.debtor.username, net: 0 }
    from.net -= d.amount
    balance.set(d.fromUser, from)
    const to = balance.get(d.toUser) ?? { name: d.creditor.username, net: 0 }
    to.net += d.amount
    balance.set(d.toUser, to)
  }

  const debtors = [...balance.entries()]
    .filter(([, b]) => b.net < -0.01)
    .map(([id, b]) => ({ id, name: b.name, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt)
  const creditors = [...balance.entries()]
    .filter(([, b]) => b.net > 0.01)
    .map(([id, b]) => ({ id, name: b.name, amt: b.net }))
    .sort((a, b) => b.amt - a.amt)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amt, creditors[j].amt)
    settlements.push({
      fromId: debtors[i].id,
      fromName: debtors[i].name,
      toId: creditors[j].id,
      toName: creditors[j].name,
      amount: Math.round(transfer * 100) / 100,
    })
    debtors[i].amt -= transfer
    creditors[j].amt -= transfer
    if (debtors[i].amt < 0.01) i++
    if (creditors[j].amt < 0.01) j++
  }
  return settlements
}

/** Settle a simplified settlement: clears matching pending debts by net effect. */
export async function settleSimplified(s: Settlement) {
  const user = await requireDbUser()

  // Simplest correct approach: mark all pending debts between the pair (both
  // directions) as settled, then re-insert the residual net imbalances minus
  // this settlement. For wing-scale data we settle direct debts greedily.
  await settleDirectPair(s.fromId, s.toId, s.amount)

  await logActivity(
    user.id,
    'debt_settled',
    `[LIQUIDATION] ₹${s.amount.toLocaleString('en-IN')} margin call met. @${s.fromName} → @${s.toName}`,
  )
  revalidatePath('/hub')
  revalidatePath('/hub/ledger')
}

export async function getDebts(userId: string) {
  return await db.query.debts.findMany({
    where: (d) => or(eq(d.fromUser, userId), eq(d.toUser, userId)),
  })
}

export async function getExpenses(userId: string) {
  return await db.query.expenses.findMany({
    where: eq(expenses.createdBy, userId),
    orderBy: [desc(expenses.createdAt)],
  })
}

export async function settleDebts(userId: string) {
  const user = await requireDbUser()
  if (user.id !== userId) throw new Error('Unauthorized')
  
  // Get all debts for this user
  const userDebts = await db.query.debts.findMany({
    where: (d) => or(eq(d.fromUser, userId), eq(d.toUser, userId)),
  })
  
  // Simplify debts using multi-hop settlement
  // For now, just mark pending debts as settled if user initiates
  const pending = userDebts.filter((d) => d.status === 'pending' && d.fromUser === userId)
  
  for (const debt of pending) {
    await db
      .update(debts)
      .set({ status: 'settled', settledAt: new Date() })
      .where(eq(debts.id, debt.id))
  }
  
  await logActivity(user.id, 'debts_settled', `[RECONCILE] net balances simplified`)
  revalidatePath('/hub')
  revalidatePath('/hub/ledger')
}

async function settleDirectPair(fromId: string, toId: string, amount: number) {
  const pending = await db
    .select()
    .from(debts)
    .where(and(eq(debts.fromUser, fromId), eq(debts.toUser, toId), eq(debts.status, 'pending')))

  let remaining = amount
  for (const d of pending) {
    if (remaining <= 0.01) break
    if (d.amount <= remaining + 0.01) {
      await db
        .update(debts)
        .set({ status: 'settled', settledAt: new Date() })
        .where(eq(debts.id, d.id))
      remaining -= d.amount
    } else {
      await db.update(debts).set({ amount: d.amount - remaining }).where(eq(debts.id, d.id))
      await db.insert(debts).values({
        fromUser: fromId,
        toUser: toId,
        amount: remaining,
        expenseId: d.expenseId,
        status: 'settled',
        settledAt: new Date(),
      })
      remaining = 0
    }
  }

  // If a net settlement exceeds direct debts (multi-hop simplification),
  // record a reverse pending debt so net balances across the wing stay exact:
  // paying more than you directly owe someone makes them owe you the excess.
  if (remaining > 0.01) {
    await db.insert(debts).values({
      fromUser: toId,
      toUser: fromId,
      amount: remaining,
      status: 'pending',
    })
  }
}
