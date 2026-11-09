import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, CloudDownload, Settings as Gear } from 'lucide-react';
import { TransactionRow } from '../components/TransactionRow';
import { MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { formatDay, formatMonth, monthOf, todayISO } from '../domain/dates';
import { nextPayday } from '../domain/salary';
import { currentBalance, monthTotals, spendByCategory } from '../domain/reports';
import { OVERALL_BUDGET_ID } from '../domain/types';

export default function Home() {
  const d = useAppData();
  const { month } = useUi();
  if (!d.ready) return null;

  const today = todayISO();
  const isCurrent = month === monthOf(today);
  const totals = monthTotals(d.transactions, month);
  const spend = spendByCategory(d.transactions, month);
  const left = totals.incomeCents - totals.expenseCents;
  const balance = currentBalance(d.transactions, d.settings.openingBalanceCents, today);
  const usedRatio = totals.incomeCents ? totals.expenseCents / totals.incomeCents : totals.expenseCents ? 1 : 0;
  const salary = d.settings.salary;
  const pay = salary && nextPayday(salary, today);
  const payThisMonth = isCurrent && pay && monthOf(pay) === month;
  const recent = d.transactions
    .filter((t) => t.type === 'expense' && monthOf(t.date) === month)
    .slice(0, 5);
  const isNew = d.transactions.length === 0 && !salary;

  const over = d.budgets.filter((b) =>
    b.amountCents < (b.id === OVERALL_BUDGET_ID ? totals.expenseCents : spend.get(b.id) ?? 0));
  const backupDays = d.settings.lastBackupAt
    ? (Date.now() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000
    : Infinity;
  const label = isCurrent ? 'this month' : `in ${formatMonth(month).split(' ')[0]}`;

  return (
    <div className="stack">
      <MonthPicker action={<Link to="/settings" className="icon-btn" aria-label="Settings"><Gear size={22} aria-hidden /></Link>} />

      <section className="hero" aria-label="Money left">
        <p className="hero-label">{left < 0 ? `Overspent ${label}` : `Left ${label}`}</p>
        <p className={`hero-value${left < 0 ? ' negative' : ''}`}>{d.money(Math.abs(left))}</p>
        <div className="hero-bar" role="img" aria-label={`${Math.round(usedRatio * 100)}% of income spent`}>
          <span style={{ width: `${Math.min(usedRatio, 1) * 100}%` }} />
        </div>
        {payThisMonth && <p className="hero-note">Salary of {d.money(salary.amountCents)} expected on {formatDay(pay)}. It isn't counted until then.</p>}
      </section>

      <section className="stats" aria-label="Summary">
        <Link to="/income"><span className="muted">Income</span><strong>{d.money(totals.incomeCents)}</strong></Link>
        <Link to="/expenses"><span className="muted">Expenses</span><strong>{d.money(totals.expenseCents)}</strong></Link>
        <div><span className="muted">Overall balance today</span><strong>{d.money(balance)}</strong></div>
      </section>

      {isNew && (
        <section className="panel">
          <h2>Get started</h2>
          <p className="muted">Set your salary once and it will be added on payday each month. If you already have money saved, set your starting balance too.</p>
          <div className="row-actions">
            <Link className="btn primary" to="/income">Set salary</Link>
            <Link className="btn" to="/settings">Set starting balance</Link>
          </div>
        </section>
      )}

      {over.length > 0 && (
        <Link to="/budget" className="notice over">
          <CircleAlert size={18} aria-hidden />
          <span className="grow">{over.length === 1 ? '1 budget is' : `${over.length} budgets are`} over the limit</span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Recent expenses</h2>{recent.length > 0 && <Link to="/expenses">See all</Link>}</div>
        {recent.length ? (
          <ul className="plain-list">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
            ))}
          </ul>
        ) : (
          <p className="muted">No expenses {label}. Tap + to add one.</p>
        )}
      </section>

      {!isNew && backupDays > 30 && (
        <Link to="/settings" className="notice">
          <CloudDownload size={18} aria-hidden />
          <span className="grow">Your data is only on this device. Save a backup.</span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}
    </div>
  );
}
