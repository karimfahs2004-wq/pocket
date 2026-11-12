import { Plus } from 'lucide-react';
import { TransactionRow } from '../components/TransactionRow';
import { BackButton, MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { monthOf } from '../domain/dates';

export default function Income() {
  const d = useAppData();
  const { month, newTransaction } = useUi();
  if (!d.ready) return null;

  const items = d.transactions.filter((t) => t.type === 'income' && monthOf(t.date) === month);
  const total = items.reduce((s, t) => s + t.amountCents, 0);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line">
          <BackButton />
          <h1>Income</h1>
        </div>
      </header>

      <MonthPicker settings={false} />
      <section className="panel">
        <div className="panel-head">
          <h2>Received: <span className="num">{d.money(total)}</span></h2>
          <button className="btn small" onClick={() => newTransaction('income')}><Plus size={15} aria-hidden />Add income</button>
        </div>
        {items.length ? (
          <ul className="plain-list">
            {items.map((t) => (
              <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
            ))}
          </ul>
        ) : <p className="muted">No income received in this month.</p>}
      </section>
    </div>
  );
}
