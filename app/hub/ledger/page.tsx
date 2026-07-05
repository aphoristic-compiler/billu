'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { getDebts, getExpenses, settleDebts, settleSingleDebt } from '@/lib/actions/expenses';
import { getMembers } from '@/lib/actions/events';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';
import { AddExpenseForm } from '@/components/events/add-expense-form';

export default function LedgerPage() {
  const { user } = useUser();
  const [debts, setDebts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settling, setSettling] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [d, e, m] = await Promise.all([getDebts(), getExpenses(), getMembers()]);
      setDebts(d);
      setExpenses(e);
      setMembers(m);
    };
    load();
  }, [user]);

  if (!user) return null;

  const handleSettle = async () => {
    setSettling(true);
    try {
      await settleDebts();
      toast('DEBTS_SIMPLIFIED', 'success');
      const d = await getDebts();
      setDebts(d);
    } catch (err) {
      toast('SETTLEMENT_FAILED', 'error');
    } finally {
      setSettling(false);
    }
  };

  const handleSettleSingle = async (debtId: string) => {
    try {
      await settleSingleDebt(debtId);
      toast('DEBT_SETTLED', 'success');
      const d = await getDebts();
      setDebts(d);
    } catch (err: any) {
      toast(err.message || 'SETTLEMENT_FAILED', 'error');
    }
  };

  const currentUserId = members.find((m) => m.clerkId === user.id)?.id || '';

  const pendingDebts = debts.filter((d) => d.status === 'pending');

  const netBalance = pendingDebts
    .reduce((sum, d) => sum + (d.fromUser === currentUserId ? -d.amount : d.amount), 0);

  return (
    <div className="space-y-4 font-mono text-xs">
      <div className="border border-accent/30 bg-background/50 p-4">
        <h2 className="mb-2 text-accent">MARGIN_CALL_LEDGER</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-secondary">NET_BALANCE</p>
            <p className={`text-2xl font-bold ${netBalance > 0 ? 'text-success' : netBalance < 0 ? 'text-warning' : 'text-tertiary'}`}>
              {Math.abs(netBalance).toFixed(2)}
            </p>
            {netBalance > 0 ? <p className="text-success">YOU_ARE_OWED</p> : netBalance < 0 ? <p className="text-warning">YOU_OWE</p> : <p className="text-tertiary">SETTLED</p>}
          </div>
          <div>
            <p className="text-secondary">TOTAL_EXPENSES</p>
            <p className="text-2xl font-bold text-accent">{expenses.length}</p>
            <p className="text-tertiary">{expenses.reduce((sum, e) => sum + e.totalAmount, 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {pendingDebts.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">ACTIVE_DEBTS</h3>
          <div className="space-y-2">
            {pendingDebts.map((debt, i) => (
              <div key={i} className="border-l-2 border-accent/30 pl-2 flex justify-between items-center pr-2">
                <div>
                  <p className="text-secondary">{debt.status.toUpperCase()}</p>
                  <p className="text-accent">{Math.abs(debt.amount).toFixed(2)}</p>
                  <p className="text-tertiary">
                    {debt.fromUser === currentUserId ? `YOU OWE @${debt.creditor?.username || '??'}` : `@${debt.debtor?.username || '??'} OWES YOU`}
                  </p>
                  {debt.note && <p className="text-tertiary italic">{debt.note}</p>}
                </div>
                {debt.status === 'pending' && debt.toUser === currentUserId && (
                  <button
                    onClick={() => handleSettleSingle(debt.id)}
                    className="text-[10px] text-profit border border-profit/30 bg-profit/5 px-2 py-1 rounded hover:bg-profit/10"
                  >
                    [SETTLE]
                  </button>
                )}
              </div>
            ))}
          </div>
          {pendingDebts.length > 0 && (
            <CandlestickButton onClick={handleSettle} isLoading={settling} className="mt-3 w-full">
              {settling ? 'SIMPLIFYING...' : 'SIMPLIFY_DEBTS'}
            </CandlestickButton>
          )}
        </div>
      )}

      <button
        onClick={() => setShowExpenses(!showExpenses)}
        className="w-full border border-accent/30 bg-background/50 p-2 text-secondary hover:border-accent hover:text-accent"
      >
        {showExpenses ? '[−] EXPENSE_LOG' : '[+] EXPENSE_LOG'} ({expenses.length})
      </button>

      {showExpenses && expenses.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">RECENT_EXPENSES</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {expenses.map((exp, i) => (
              <div key={i} className="border-l-2 border-accent/10 pl-2 text-tertiary">
                <p className="text-accent">
                  {exp.title}
                  {exp.event && (
                    <span className="text-muted-foreground">
                      {' '}@ {exp.event.location === 'other' ? exp.event.locationCustom : exp.event.location?.replace('_', ' ')}
                    </span>
                  )}
                </p>
                <p>{exp.totalAmount.toFixed(2)} | {new Date(exp.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <AddExpenseForm members={members} currentUserId={currentUserId} />
        </div>
      )}

    </div>
  );
}
