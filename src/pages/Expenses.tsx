import { useMemo } from 'react';
import { TransactionRow } from '../components/TransactionRow';
import { Empty, MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { formatDayFull, monthOf } from '../domain/dates';

export default function Expenses() {
  const d = useAppData();
  const { month, newTransaction } = useUi();

  const expenses = useMemo(
    () => d.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === month),
    [d.transactions, month],
  );
  const groups = useMemo(() => {
    const m = new Map<string, typeof expenses>();
    for (const t of expenses) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [expenses]);

  if (!d.ready) return null;
  const total = expenses.reduce((s, t) => s + t.amountCents, 0);

  return (
    <div className="stack">
      <MonthPicker />
      <div className="total">
        <span className="muted">Total spent</span>
        <strong>{d.money(total)}</strong>
      </div>
      {groups.length === 0 ? (
        <Empty title="No expenses this month">
          <button className="btn primary" onClick={() => newTransaction()}>Add expense</button>
        </Empty>
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="day">
            <h2 className="day-head">{formatDayFull(date)}</h2>
            <ul className="plain-list panel tight">
              {items.map((t) => (
                <TransactionRow key={t.id} tx={t} showDate={false} category={d.categoryById.get(t.categoryId)} money={d.money} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
