import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, CloudDownload, TriangleAlert, Wallet } from 'lucide-react';
import { budgetStatus } from '../domain/budget';
import { saveBackupFile } from '../data/saveBackup';
import { TransactionRow } from '../components/TransactionRow';
import { CatIcon } from '../components/CatIcon';
import { PaceChart } from '../components/PaceChart';
import { useCountUp } from '../components/useCountUp';
import { MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { addDays, addMonthKey, formatMonth, monthOf, todayISO } from '../domain/dates';
import { averageMonthlySpend, cumulativeByDay, monthTotals, spendByCategory } from '../domain/reports';
import { updateSettings } from '../data/repo';
import { OVERALL_BUDGET_ID } from '../domain/types';

/** How often to ask for a backup. */
const BACKUP_EVERY_DAYS = 14;
const TOP_CATEGORIES = 4;

/**
 * Home shows spending only. Income, salary, cash and savings are private, so they live
 * on the My money page and never appear here.
 */
export default function Home() {
  const d = useAppData();
  const { month, setMonth, toast } = useUi();
  const count = useCountUp(d.ready ? monthTotals(d.transactions, month).expenseCents : 0);
  if (!d.ready) return null;

  const today = todayISO();
  const thisMonth = monthOf(today);
  const isCurrent = month === thisMonth;
  const monthName = formatMonth(month).split(' ')[0];
  const label = isCurrent ? 'this month' : `in ${monthName}`;

  const expenses = d.transactions.filter((t) => t.type === 'expense' && monthOf(t.date) === month);
  const spent = monthTotals(d.transactions, month).expenseCents;
  const spend = spendByCategory(d.transactions, month);
  const top = [...spend.entries()].sort((a, b) => b[1] - a[1]);
  const biggest = top[0]?.[1] ?? 1;

  // Days counted so far: up to today for this month, the whole month for past ones.
  const [y, m] = month.split('-').map(Number);
  const days = isCurrent ? Number(today.slice(8)) : new Date(y, m, 0).getDate();

  // Today and this week (Monday to today), across all expenses.
  const [ty, tm, td] = today.split('-').map(Number);
  const monday = addDays(today, -((new Date(ty, tm - 1, td).getDay() + 6) % 7));
  const all = d.transactions.filter((t) => t.type === 'expense');
  const sumOf = (list: typeof all) => list.reduce((s, t) => s + t.amountCents, 0);
  const todayList = all.filter((t) => t.date === today);
  const weekList = all.filter((t) => t.date >= monday && t.date <= today);
  const countLabel = (n: number) => (n === 0 ? 'No expenses' : `${n} ${n === 1 ? 'expense' : 'expenses'}`);

  // Day-by-day running totals, against the month before.
  const prevOfMonth = addMonthKey(month, -1);
  const [py, pm] = prevOfMonth.split('-').map(Number);
  const pace = {
    current: cumulativeByDay(d.transactions, month, days),
    previous: cumulativeByDay(d.transactions, prevOfMonth, new Date(py, pm, 0).getDate()),
  };
  const showPace = spent > 0 || (pace.previous.at(-1) ?? 0) > 0;

  const budgetOf = (id: string) => d.budgets.find((b) => b.id === id)?.amountCents;
  const overall = budgetOf(OVERALL_BUDGET_ID);
  const status = overall ? budgetStatus(spent, overall) : undefined;
  const levels = d.budgets
    .filter((b) => b.id !== OVERALL_BUDGET_ID)
    .map((b) => budgetStatus(spend.get(b.id) ?? 0, b.amountCents).level);
  const over = levels.filter((l) => l === 'over').length;
  const near = levels.filter((l) => l === 'near').length;

  // Last month's spending review appears at the start of each month until dismissed.
  const prev = addMonthKey(thisMonth, -1);
  const prevSpent = monthTotals(d.transactions, prev).expenseCents;
  const prevTop = [...spendByCategory(d.transactions, prev).entries()].sort((a, b) => b[1] - a[1])[0];
  const before = averageMonthlySpend(d.transactions.filter((t) => t.date < `${prev}-01`), addMonthKey(prev, -1));
  const showSummary = isCurrent && (d.settings.summarySeenFor ?? '') < prev && prevSpent > 0;

  const backupDays = d.settings.lastBackupAt
    ? (Date.now() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000
    : Infinity;

  return (
    <div className="stack">
      <MonthPicker action={<Link to="/money" className="icon-btn edge" aria-label="My money"><Wallet size={22} aria-hidden /></Link>} />

      <section className="hero" aria-label={`Spent ${label}`} data-settled={count.settled || undefined}>
        <p className="hero-label">Spent {label}</p>
        <p className="hero-value" aria-label={d.money(spent)}>{d.money(count.value)}</p>
        {status ? (
          <>
            <div className={`hero-bar ${status.level}`} role="img" aria-label={`${Math.round(status.ratio * 100)}% of your budget used`}>
              <span style={{ width: `${Math.min(status.ratio, 1) * 100}%` }} />
            </div>
            <p className="hero-note">
              {status.remainingCents >= 0
                ? <><strong>{d.money(status.remainingCents)} left</strong> of your {d.money(status.limitCents)} budget</>
                : <><strong>{d.money(-status.remainingCents)} over</strong> your {d.money(status.limitCents)} budget</>}
            </p>
          </>
        ) : expenses.length > 0 ? (
          <p className="hero-note">
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}, about {d.money(Math.round(spent / days))} a day.{' '}
            <Link to="/budget">Set a budget</Link>
          </p>
        ) : (
          <p className="hero-note">Nothing spent yet. Tap + to add an expense.</p>
        )}
      </section>

      {isCurrent && (
        <section className="stats" aria-label="Today and this week">
          <Link to="/expenses"><span className="muted stat-label">Today</span><strong>{d.money(sumOf(todayList))}</strong><span className="muted tiny">{countLabel(todayList.length)}</span></Link>
          <Link to="/expenses"><span className="muted stat-label">Since Monday</span><strong>{d.money(sumOf(weekList))}</strong><span className="muted tiny">{countLabel(weekList.length)}</span></Link>
        </section>
      )}

      {showPace && (
        <section className="panel" aria-label="Spending pace">
          <h2>Spending pace</h2>
          <PaceChart {...pace} currentName={monthName} previousName={formatMonth(prevOfMonth).split(' ')[0]} money={d.money} />
        </section>
      )}

      {showSummary && (
        <section className="panel summary" aria-label={`${formatMonth(prev)} in review`}>
          <h2>{formatMonth(prev).split(' ')[0]} in review</h2>
          <dl className="insights">
            <div><dt>Spent</dt><dd>{d.money(prevSpent)}
              {before.months > 0 && prevSpent !== before.cents && (
                <small>{d.money(Math.abs(prevSpent - before.cents))} {prevSpent > before.cents ? 'more' : 'less'} than your average</small>
              )}</dd></div>
            {prevTop && <div><dt>Top category</dt><dd>{d.categoryById.get(prevTop[0])?.name ?? 'Other'}, {d.money(prevTop[1])}</dd></div>}
          </dl>
          <div className="row-actions start">
            <button className="btn small primary" onClick={() => updateSettings({ summarySeenFor: prev })}>Got it</button>
            <Link className="btn small" to="/reports" onClick={() => { setMonth(prev); void updateSettings({ summarySeenFor: prev }); }}>Open full report</Link>
          </div>
        </section>
      )}

      {(over > 0 || near > 0) && (
        <Link to="/budget" className={`notice ${over ? 'over' : 'near'}`}>
          {over ? <CircleAlert size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}
          <span className="grow">{[over && `${over} category ${over === 1 ? 'limit' : 'limits'} passed`, near && `${near} close to the limit`].filter(Boolean).join(', ')}</span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      {top.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Where it went</h2><Link to="/reports">Full report</Link></div>
          <ul className="where">
            {top.slice(0, TOP_CATEGORIES).map(([id, cents]) => {
              const c = d.categoryById.get(id);
              const limit = budgetOf(id);
              return (
                <li key={id}>
                  <span className="where-label">
                    <CatIcon small category={c} />
                    <span className="grow">{c?.name ?? 'Other'}</span>
                    <span className="num"><strong>{d.money(cents)}</strong>{limit ? <span className="muted"> of {d.money(limit)}</span> : null}</span>
                  </span>
                  <span className="where-track"><span style={{ width: `${(cents / (limit ? Math.max(limit, cents) : biggest)) * 100}%`, background: `var(--series-${(c?.colorSlot ?? 6) + 1})` }} /></span>
                </li>
              );
            })}
          </ul>
          {top.length > TOP_CATEGORIES && <p className="muted small">And {top.length - TOP_CATEGORIES} more in the full report.</p>}
        </section>
      )}

      {expenses.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Recent expenses</h2><Link to="/expenses">See all</Link></div>
          <ul className="plain-list">
            {expenses.slice(0, 5).map((t) => (
              <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
            ))}
          </ul>
        </section>
      )}

      {d.transactions.length > 0 && backupDays > BACKUP_EVERY_DAYS && (
        <section className="notice backup" aria-label="Backup">
          <CloudDownload size={18} aria-hidden />
          <span className="grow">
            <strong>{d.settings.lastBackupAt ? `Last backup ${Math.floor(backupDays)} days ago` : 'No backup yet'}</strong><br />
            <span className="small">Your data is only on this phone.</span>
          </span>
          <button className="btn small primary" onClick={async () => { if (await saveBackupFile()) toast({ message: 'Backup saved' }); }}>Back up</button>
        </section>
      )}

      <Link to="/money" className="panel link-row">
        <Wallet size={20} aria-hidden />
        <span className="grow"><strong>My money</strong><br />
          <span className="muted small">Savings, gold and silver, income</span>
        </span>
        <ChevronRight size={20} aria-hidden />
      </Link>
    </div>
  );
}
