import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { RecurringSheet } from '../components/RecurringSheet';
import { Dot, Empty, PageHead, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { deleteRecurring, setRecurringPaused } from '../data/repo';
import { formatDay, todayISO } from '../domain/dates';
import { firstOnOrAfter } from '../domain/recurring';
import type { RecurringRule } from '../domain/types';

const FREQ = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const perMonth = (r: RecurringRule) =>
  r.frequency === 'weekly' ? (r.amountCents * 52) / 12 : r.frequency === 'yearly' ? r.amountCents / 12 : r.amountCents;

export default function Recurring() {
  const d = useAppData();
  const { confirm, toast } = useUi();
  const [sheet, setSheet] = useState<{ rule?: RecurringRule } | null>(null);
  if (!d.ready) return null;

  const sorted = [...d.recurring].sort((a, b) => Number(a.paused) - Number(b.paused) || a.nextDue.localeCompare(b.nextDue));
  const monthlyOut = d.recurring.filter((r) => !r.paused && r.type === 'expense').reduce((s, r) => s + perMonth(r), 0);

  const remove = async (r: RecurringRule) => {
    const yes = await confirm({
      title: `Delete ${r.name}?`,
      body: 'Future payments will stop. Past transactions stay in your history.',
      action: 'Delete',
    });
    if (yes) { await deleteRecurring(r.id); toast({ message: 'Recurring payment deleted' }); }
  };

  return (
    <div className="stack">
      <PageHead title="Recurring" action={
        <button className="btn primary" onClick={() => setSheet({})}><Plus size={18} aria-hidden />Add</button>
      } />
      {monthlyOut > 0 && <p className="muted">Your active bills cost about <strong className="ink">{d.money(Math.round(monthlyOut))}</strong> a month.</p>}
      {sorted.length === 0 ? (
        <Empty title="No recurring payments yet">
          <p className="muted">Add your salary, gym or phone bill once, and it will be added on each due date.</p>
        </Empty>
      ) : (
        <ul className="cards">
          {sorted.map((r) => {
            const next = r.paused ? firstOnOrAfter(r.startDate, r.frequency, todayISO()) : r.nextDue;
            return (
              <li key={r.id} className={`panel rule${r.paused ? ' paused' : ''}`}>
                <div className="line">
                  <Dot slot={d.categoryById.get(r.categoryId)?.colorSlot ?? 6} />
                  <span className="grow"><strong>{r.name}</strong><br />
                    <span className="muted small">
                      {FREQ[r.frequency]}, {r.paused ? 'paused' : `next on ${formatDay(next)}`}
                    </span>
                  </span>
                  <span className={`num ${r.type === 'income' ? 'income' : ''}`}>{r.type === 'income' ? '+' : ''}{d.money(r.amountCents)}</span>
                </div>
                <div className="rule-actions">
                  <button className="btn small" onClick={() => setSheet({ rule: r })}><Pencil size={15} aria-hidden />Edit</button>
                  <button className="btn small" onClick={() => setRecurringPaused(r.id, !r.paused)}>
                    {r.paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}{r.paused ? 'Resume' : 'Pause'}
                  </button>
                  <button className="btn small ghost-danger" onClick={() => remove(r)}><Trash2 size={15} aria-hidden />Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {sheet && <RecurringSheet rule={sheet.rule} onClose={() => setSheet(null)} />}
    </div>
  );
}
