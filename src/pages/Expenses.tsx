import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TransactionRow } from '../components/TransactionRow';
import { Empty, MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { formatDayFull, formatMonth, monthOf } from '../domain/dates';
import type { Transaction } from '../domain/types';

function group(items: Transaction[], key: (t: Transaction) => string) {
  const m = new Map<string, Transaction[]>();
  for (const t of items) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return [...m.entries()];
}

export default function Expenses() {
  const d = useAppData();
  const { month } = useUi();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const all = useMemo(() => d.transactions.filter((t) => t.type === 'expense'), [d.transactions]);
  // Search covers every month, so you can find an old expense without paging back.
  const shown = useMemo(() => {
    if (!q) return all.filter((t) => monthOf(t.date) === month);
    return all.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q) ||
      d.categoryById.get(t.categoryId)?.name.toLowerCase().includes(q));
  }, [all, q, month, d.categoryById]);

  if (!d.ready) return null;
  const total = shown.reduce((s, t) => s + t.amountCents, 0);
  const close = () => { setSearching(false); setQuery(''); };

  return (
    <div className="stack">
      {searching ? (
        <div className="search-bar">
          <label className="search">
            <Search size={18} aria-hidden />
            <input type="search" autoFocus placeholder="Search all expenses" aria-label="Search all expenses" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="btn" onClick={close}>Cancel</button>
        </div>
      ) : (
        <MonthPicker action={
          <button className="icon-btn edge" onClick={() => setSearching(true)} aria-label="Search expenses"><Search size={21} aria-hidden /></button>
        } />
      )}

      {q ? (
        <>
          <div className="total">
            <span className="muted">{shown.length} {shown.length === 1 ? 'result' : 'results'}</span>
            <strong>{d.money(total)}</strong>
          </div>
          {shown.length === 0 ? (
            <Empty title="No matching expenses"><p className="muted">Search looks at names, categories and notes in every month.</p></Empty>
          ) : group(shown, (t) => monthOf(t.date)).map(([m, items]) => (
            <section key={m} className="day">
              <h2 className="day-head">{formatMonth(m)}</h2>
              <ul className="plain-list panel tight">
                {items.map((t) => <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />)}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <>
          <div className="total">
            <span className="muted">Total spent</span>
            <strong>{d.money(total)}</strong>
          </div>
          {shown.length === 0 ? (
            <Empty title="No expenses this month"><p className="muted">Tap + to add one.</p></Empty>
          ) : group(shown, (t) => t.date).map(([date, items]) => (
            <section key={date} className="day">
              <h2 className="day-head">{formatDayFull(date)}</h2>
              <ul className="plain-list panel tight">
                {items.map((t) => <TransactionRow key={t.id} tx={t} showDate={false} category={d.categoryById.get(t.categoryId)} money={d.money} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
