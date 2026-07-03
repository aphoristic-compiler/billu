'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { getDebts, getExpenses, settleDebts } from '@/lib/actions/expenses';
import { toast } from '@/components/terminal-toast';
import { CandlestickButton } from '@/components/candlestick-button';

export default function LedgerPage() {
  const { user } = useUser();
  const [debts, setDebts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settling, setSettling] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [d, e] = await Promise.all([getDebts(user.id), getExpenses(user.id)]);
      setDebts(d);
      setExpenses(e);
    };
    load();
  }, [user]);

  if (!user) return null;

  const handleSettle = async () => {
    setSettling(true);
    try {
      await settleDebts(user.id);
      toast('DEBTS_SIMPLIFIED', 'success');
      const [d, e] = await Promise.all([getDebts(user.id), getExpenses(user.id)]);
      setDebts(d);
      setExpenses(e);
    } catch (err) {
      toast('SETTLE_FAILED', 'warning');
    } finally {
      setSettling(false);
    }
  };

  const netBalance = debts.reduce((sum, d) => sum + (d.fromUser === user.id ? -d.amount : d.amount), 0);

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
            <p className="text-tertiary">{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {debts.length > 0 && (
        <div className="border border-accent/30 bg-background/50 p-4">
          <h3 className="mb-2 text-accent">ACTIVE_DEBTS</h3>
          <div className="space-y-2">
            {debts.map((debt, i) => (
              <div key={i} className="border-l-2 border-accent/30 pl-2">
                <p className="text-secondary">{debt.status.toUpperCase()}</p>
                <p className="text-accent">{Math.abs(debt.amount).toFixed(2)}</p>
                <p className="text-tertiary">
                  {debt.fromUser === user.id ? `YOU→${debt.toUser}` : `${debt.fromUser}→YOU`}
                </p>
                {debt.note && <p className="text-tertiary italic">{debt.note}</p>}
              </div>
            ))}
          </div>
          {debts.some(d => d.status === 'pending') && (
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
                <p className="text-accent">{exp.description}</p>
                <p>{exp.amount.toFixed(2)} | {new Date(exp.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
