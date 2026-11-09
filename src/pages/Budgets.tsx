import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AmountField } from '../components/AmountField';
import { Dot, Empty, LevelBadge, Meter, MonthPicker, primeKeyboard, Sheet, useUi } from '../components/ui';
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
  const { toast } = useUi();
  const [amount, setAmount] = useState(current ? centsToInput(current) : '');
  const [chosen, setChosen] = useState(id ?? '');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (!cents) return setError('Enter an amount above 0, like 300.');
    if (!chosen) return setError('Choose a category.');
    await setBudget({ id: chosen, amountCents: cents });
    toast({
      message: 'Limit saved',
      undo: () => void (current !== undefined ? setBudget({ id: chosen, amountCents: current }) : removeBudget(chosen)),
    });
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
          <button type="button" className="btn ghost-danger wide" onClick={async () => {
            await removeBudget(id);
            toast({ message: 'Limit removed', undo: () => void setBudget({ id, amountCents: current }) });
            onClose();
          }}>Remove limit</button>
        )}
      </form>
    </Sheet>
  );
}

export default function Budgets() {
  const d = useAppData();
  const { month } = useUi();
  const [editing, setEditingState] = useState<{ id?: string; title: string; current?: number; pick?: boolean } | null>(null);
  const setEditing = (e: Parameters<typeof setEditingState>[0]) => { if (e) primeKeyboard(); setEditingState(e); };
  if (!d.ready) return null;

  const totals = monthTotals(d.transactions, month);
  const spend = spendByCategory(d.transactions, month);
  const overall = d.budgets.find((b) => b.id === OVERALL_BUDGET_ID);
  const catBudgets = d.budgets.filter((b) => b.id !== OVERALL_BUDGET_ID);
  const available = d.categories.filter(
    (c) => c.kind === 'expense' && !c.archived && !catBudgets.some((b) => b.id === c.id),
  );

  /** Same pattern as expenses: tap the card or its pencil to edit. */
  const BudgetCard = ({ name, slot, status: s, onEdit }: { name: string; slot?: number; status: BudgetStatus; onEdit: () => void }) => (
    <div className="panel budget" onClick={onEdit}>
      <span className="line">
        {slot !== undefined && <Dot slot={slot} />}
        <strong className="grow">{name}</strong>
        <LevelBadge level={s.level} />
        <button className="icon-btn tx-edit" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`Edit ${name}`}><Pencil size={18} aria-hidden /></button>
      </span>
      <Meter ratio={s.ratio} level={s.level} />
      <span className="budget-nums small">
        <span className="muted">{Math.round(s.ratio * 100)}% used, {d.money(s.spentCents)} of {d.money(s.limitCents)}</span>
        <strong className="num">{s.remainingCents >= 0 ? `${d.money(s.remainingCents)} left` : `${d.money(-s.remainingCents)} over`}</strong>
      </span>
    </div>
  );

  return (
    <div className="stack">
      <MonthPicker />

      {overall ? (
        <BudgetCard
          name="Monthly budget"
          status={budgetStatus(totals.expenseCents, overall.amountCents)}
          onEdit={() => setEditing({ id: OVERALL_BUDGET_ID, title: 'Monthly budget', current: overall.amountCents })}
        />
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
                <BudgetCard
                  name={c?.name ?? 'Category'}
                  slot={c?.colorSlot ?? 6}
                  status={s}
                  onEdit={() => setEditing({ id: b.id, title: `${c?.name ?? 'Category'} limit`, current: b.amountCents })}
                />
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
