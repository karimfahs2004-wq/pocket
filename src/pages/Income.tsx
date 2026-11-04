import { ArrowLeft, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AmountField } from '../components/AmountField';
import { TransactionRow } from '../components/TransactionRow';
import { MonthPicker, Sheet, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { removeSalary, saveSalary } from '../data/repo';
import { formatDay, monthOf, todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import { nextPayday } from '../domain/salary';
import type { Salary } from '../domain/types';

function SalarySheet({ salary, onClose }: { salary?: Salary; onClose: () => void }) {
  const { toast, confirm } = useUi();
  const [amount, setAmount] = useState(salary ? centsToInput(salary.amountCents) : '');
  const [day, setDay] = useState(String(salary?.payDay ?? 1));
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    const payDay = Number(day);
    if (!cents) return setError('Enter an amount above 0, like 1200.');
    await saveSalary(cents, payDay);
    toast({ message: 'Salary saved' });
    onClose();
  };
  const remove = async () => {
    const yes = await confirm({
      title: 'Stop adding salary?',
      body: 'Salary already received stays in your history.',
      action: 'Stop salary',
    });
    if (!yes) return;
    await removeSalary();
    toast({ message: 'Salary stopped' });
    onClose();
  };

  return (
    <Sheet title={salary ? 'Change salary' : 'Set your salary'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <AmountField label="Monthly salary" large autoFocus value={amount} onChange={setAmount} error={error} />
        <div className="field">
          <label htmlFor="pay-day">Payday</label>
          <select id="pay-day" value={day} onChange={(e) => setDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>Day {i + 1} of the month</option>)}
          </select>
          <p className="hint">
            {salary
              ? 'Applies from your next payday. Past months stay as they are.'
              : "It's added on payday each month. If this month's payday has passed, this month is added too."}
          </p>
        </div>
        <div className="sheet-actions">
          <button className="btn primary wide">Save salary</button>
          {salary && <button type="button" className="btn ghost-danger wide" onClick={remove}>Stop salary</button>}
        </div>
      </form>
    </Sheet>
  );
}

export default function Income() {
  const d = useAppData();
  const { month, newTransaction } = useUi();
  const [editing, setEditing] = useState(false);
  if (!d.ready) return null;

  const salary = d.settings.salary;
  const items = d.transactions.filter((t) => t.type === 'income' && monthOf(t.date) === month);
  const total = items.reduce((s, t) => s + t.amountCents, 0);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line">
          <Link to="/" className="icon-btn" aria-label="Back to Home"><ArrowLeft size={22} aria-hidden /></Link>
          <h1>Income</h1>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Monthly salary</h2>
          {salary && <button className="btn small" onClick={() => setEditing(true)}>Change</button>}
        </div>
        {salary ? (
          <p><strong className="big-num">{d.money(salary.amountCents)}</strong><br />
            <span className="muted small">Next payday: {formatDay(nextPayday(salary, todayISO()))}</span></p>
        ) : (
          <>
            <p className="muted">Set it once and it's added on payday each month.</p>
            <button className="btn primary start" onClick={() => setEditing(true)}>Set salary</button>
          </>
        )}
      </section>

      <MonthPicker />
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
      {editing && <SalarySheet salary={salary} onClose={() => setEditing(false)} />}
    </div>
  );
}
