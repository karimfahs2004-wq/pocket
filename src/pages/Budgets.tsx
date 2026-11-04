import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AmountField } from '../components/AmountField';
import { Dot, Empty, LevelBadge, Meter, MonthPicker, Sheet, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { removeBudget, setBudget } from '../data/repo';
import { budgetStatus, type BudgetStatus } from '../domain/budget';
import { centsToInput, parseAmount } from '../domain/money';
import { monthTotals, spendByCategory } from '../domain/reports';
import { OVERALL_BUDGET_ID } from '../domain/types';

function BudgetSheet({ id, title, current, categories, onClose }: {
  id?: string; title: string; current?: number;
  categories?: { id: string; name: string }[]; onClose: () => void;
}) {
  const [amount, setAmount] = useState(current ? centsToInput(current) : '');
  const [chosen, setChosen] = useState(id ?? '');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (!cents) return setError('Enter an amount above 0, like 300.');
    if (!chosen) return setError('Choose a category.');
    await setBudget({ id: chosen, amountCents: cents });
    onClose();
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {categories && (
          <div className="field">
            <label htmlFor="b-cat">Category</label>
            <select id="b-cat" value={chosen} onChange={(e) => setChosen(e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <AmountField label="Monthly limit" large autoFocus value={amount} onChange={setAmount} error={error} />
        <button className="btn primary wide">Save limit</button>
        {id && current !== undefined && (
          <button type="button" className="btn ghost-danger wide" onClick={async () => { await removeBudget(id); onClose(); }}>Remove limit</button>
        )}
      </form>
    </Sheet>
  );
}

export default function Budgets() {
  const d = useAppData();
  const { month } = useUi();
  const [editing, setEditing] = useState<{ id?: string; title: string; current?: number; pick?: boolean } | null>(null);
  if (!d.ready) return null;

  const totals = monthTotals(d.transactions, month);
  const spend = spendByCategory(d.transactions, month);
  const overall = d.budgets.find((b) => b.id === OVERALL_BUDGET_ID);
  const catBudgets = d.budgets.filter((b) => b.id !== OVERALL_BUDGET_ID);
  const available = d.categories.filter(
    (c) => c.kind === 'expense' && !c.archived && !catBudgets.some((b) => b.id === c.id),
  );

  const Summary = ({ s }: { s: BudgetStatus }) => (
    <>
      <Meter ratio={s.ratio} level={s.level} />
      <span className="budget-nums small">
        <span className="muted">{Math.round(s.ratio * 100)}% used, {d.money(s.spentCents)} of {d.money(s.limitCents)}</span>
        <strong className="num">{s.remainingCents >= 0 ? `${d.money(s.remainingCents)} left` : `${d.money(-s.remainingCents)} over`}</strong>
      </span>
    </>
  );

  return (
    <div className="stack">
      <MonthPicker />

      {overall ? (
        <button className="panel budget" onClick={() => setEditing({ id: OVERALL_BUDGET_ID, title: 'Monthly budget', current: overall.amountCents })}>
          <span className="line"><strong className="grow">Monthly budget</strong><LevelBadge level={budgetStatus(totals.expenseCents, overall.amountCents).level} /></span>
          <Summary s={budgetStatus(totals.expenseCents, overall.amountCents)} />
        </button>
      ) : (
        <Empty title="No monthly budget yet">
          <p className="muted">A budget is the most you plan to spend in a month. You'll see a warning at 80% and when you go over.</p>
          <button className="btn primary" onClick={() => setEditing({ id: OVERALL_BUDGET_ID, title: 'Monthly budget' })}>Set monthly budget</button>
        </Empty>
      )}

      <div className="panel-head">
        <h2>Category limits</h2>
        {available.length > 0 && (
          <button className="btn small" onClick={() => setEditing({ title: 'Add category limit', pick: true })}><Plus size={15} aria-hidden />Add</button>
        )}
      </div>
      {catBudgets.length === 0 ? (
        <p className="muted">Optional. Set a limit for a category you want to watch, like Food.</p>
      ) : (
        <ul className="cards">
          {catBudgets.map((b) => {
            const c = d.categoryById.get(b.id);
            const s = budgetStatus(spend.get(b.id) ?? 0, b.amountCents);
            return (
              <li key={b.id}>
                <button className="panel budget" onClick={() => setEditing({ id: b.id, title: `${c?.name ?? 'Category'} limit`, current: b.amountCents })}>
                  <span className="line"><Dot slot={c?.colorSlot ?? 6} /><strong className="grow">{c?.name ?? 'Category'}</strong><LevelBadge level={s.level} /></span>
                  <Summary s={s} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <BudgetSheet
          key={editing.title}
          id={editing.id}
          title={editing.title}
          current={editing.current}
          categories={editing.pick ? available : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
