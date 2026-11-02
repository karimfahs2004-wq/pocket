import { Link } from 'react-router-dom';
import { CloudDownload, Settings as Gear } from 'lucide-react';
import { useState } from 'react';
import { useAppData } from '../data/hooks';
import { budgetStatus } from '../domain/budget';
import { addDays, formatDay, formatMonth, monthOf, todayISO } from '../domain/dates';
import { upcomingPayments } from '../domain/recurring';
import { currentBalance, monthTotals, spendByCategory } from '../domain/reports';
import { OVERALL_BUDGET_ID } from '../domain/types';
import { MonthStrip } from '../components/MonthStrip';
import { RecurringSheet } from '../components/RecurringSheet';
import { TransactionRow } from '../components/TransactionRow';
import { Dot, LevelBadge, useUi } from '../components/ui';

export default function Home() {
  const d = useAppData();
  const { newTransaction } = useUi();
  const [addSalary, setAddSalary] = useState(false);
  if (!d.ready) return null;

  const today = todayISO();
  const month = monthOf(today);
  const totals = monthTotals(d.transactions, month);
  const spend = spendByCategory(d.transactions, month);
  const left = totals.incomeCents - totals.expenseCents;
  const balance = currentBalance(d.transactions, d.settings.openingBalanceCents, today);
  const upcoming = upcomingPayments(d.recurring, today, addDays(today, 30));
  const stillDue = upcoming.filter((u) => monthOf(u.date) === month).reduce((s, u) => s + u.rule.amountCents, 0);

  const alerts = d.budgets
    .map((b) => {
      const spent = b.id === OVERALL_BUDGET_ID ? totals.expenseCents : spend.get(b.id) ?? 0;
      const name = b.id === OVERALL_BUDGET_ID ? 'Monthly budget' : d.categoryById.get(b.id)?.name ?? 'Budget';
      return { id: b.id, name, ...budgetStatus(spent, b.amountCents) };
    })
    .filter((a) => a.level !== 'ok')
    .sort((a, b) => b.ratio - a.ratio);

  const isNew = d.transactions.length === 0 && d.recurring.length === 0;
  const backupDays = d.settings.lastBackupAt
    ? (Date.now() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000
    : Infinity;

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{formatMonth(month)}</h1>
        <Link to="/settings" className="icon-btn" aria-label="Settings"><Gear size={22} aria-hidden /></Link>
      </header>

      <section className="hero" aria-label="This month">
        <p className="hero-label">{left < 0 ? 'Overspent this month' : 'Left this month'}</p>
        <p className={`hero-value${left < 0 ? ' negative' : ''}`}>{d.money(Math.abs(left))}</p>
        <MonthStrip incomeCents={totals.incomeCents} expenseCents={totals.expenseCents} spend={spend} categoryById={d.categoryById} money={d.money} />
        {stillDue > 0 && <p className="hero-note">{d.money(stillDue)} in bills still due this month</p>}
      </section>

      <section className="stats" aria-label="Summary">
        <div><span className="muted">Income</span><strong>{d.money(totals.incomeCents)}</strong></div>
        <div><span className="muted">Expenses</span><strong>{d.money(totals.expenseCents)}</strong></div>
        <div><span className="muted">Overall balance</span><strong>{d.money(balance)}</strong></div>
      </section>

      {isNew && (
        <section className="panel">
          <h2>Get started</h2>
          <p className="muted">Add your salary once and it will appear every month. If you already have money saved, set your starting balance too.</p>
          <div className="row-actions">
            <button className="btn primary" onClick={() => setAddSalary(true)}>Add salary</button>
            <Link className="btn" to="/settings">Set starting balance</Link>
          </div>
        </section>
      )}

      {alerts.length > 0 && (
        <section className="panel" aria-label="Budget warnings">
          <ul className="alerts">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to="/budget">
                  <span><strong>{a.name}</strong><br /><span className="muted">
                    {a.level === 'over'
                      ? `${d.money(-a.remainingCents)} over ${d.money(a.limitCents)}`
                      : `${d.money(a.remainingCents)} left of ${d.money(a.limitCents)}`}
                  </span></span>
                  <LevelBadge level={a.level} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isNew && backupDays > 30 && (
        <Link to="/settings" className="nudge">
          <CloudDownload size={20} aria-hidden />
          <span>Your data is only on this device. Save a backup.</span>
        </Link>
      )}

      {upcoming.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Upcoming bills</h2><Link to="/recurring">See all</Link></div>
          <ul className="plain-list">
            {upcoming.slice(0, 4).map((u) => (
              <li key={u.rule.id + u.date} className="line">
                <Dot slot={d.categoryById.get(u.rule.categoryId)?.colorSlot ?? 6} />
                <span className="grow">{u.rule.name}<br /><span className="muted small">{formatDay(u.date)}</span></span>
                <span className="num">{d.money(u.rule.amountCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Recent transactions</h2>{d.transactions.length > 0 && <Link to="/transactions">See all</Link>}</div>
        {d.transactions.length ? (
          <ul className="plain-list">
            {d.transactions.slice(0, 5).map((t) => (
              <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing yet. <button className="link" onClick={() => newTransaction()}>Add your first transaction</button></p>
        )}
      </section>

      {addSalary && <RecurringSheet salary onClose={() => setAddSalary(false)} />}
    </div>
  );
}
