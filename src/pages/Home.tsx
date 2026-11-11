import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, CloudDownload, TriangleAlert } from 'lucide-react';
import { budgetStatus } from '../domain/budget';
import { saveBackupFile } from '../data/saveBackup';
import { TransactionRow } from '../components/TransactionRow';
import { InfoTip, MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { formatDay, formatMonth, monthOf, todayISO } from '../domain/dates';
import { nextPayday } from '../domain/salary';
import { averageMonthlySpend, currentBalance, monthTotals, spendByCategory } from '../domain/reports';
import { formatQuantity, holdings, savedInMonth, savedUpTo } from '../domain/savings';
import { addMonthKey } from '../domain/dates';
import { updateSettings } from '../data/repo';
import { OVERALL_BUDGET_ID } from '../domain/types';

/** How often to ask for a backup. */
const BACKUP_EVERY_DAYS = 14;

export default function Home() {
  const d = useAppData();
  const { month, setMonth, toast } = useUi();
  if (!d.ready) return null;

  const today = todayISO();
  const isCurrent = month === monthOf(today);
  const totals = monthTotals(d.transactions, month);
  const spend = spendByCategory(d.transactions, month);
  // Money saved or invested isn't spending, but it isn't free to spend either.
  const saved = savedInMonth(d.savings, month);
  // Everything in savings and investments today: cash plus what you paid for gold and silver.
  const totalSaved = savedUpTo(d.savings, today);
  const left = totals.incomeCents - totals.expenseCents - saved;
  const balance = currentBalance(d.transactions, d.settings.openingBalanceCents, today) - totalSaved;
  const out = totals.expenseCents + Math.max(saved, 0);
  const usedRatio = totals.incomeCents ? out / totals.incomeCents : out ? 1 : 0;
  const h = holdings(d.savings);
  const metals = [h.gold.quantityMilli > 0 && formatQuantity(h.gold.quantityMilli, 'gold') + ' of gold', h.silver.quantityMilli > 0 && formatQuantity(h.silver.quantityMilli, 'silver') + ' of silver'].filter(Boolean).join(', ');

  // Last month's review appears at the start of each month until you dismiss it.
  const prev = addMonthKey(monthOf(today), -1);
  const prevTotals = monthTotals(d.transactions, prev);
  const prevSaved = savedInMonth(d.savings, prev);
  const prevSpend = [...spendByCategory(d.transactions, prev).entries()].sort((a, b) => b[1] - a[1]);
  const before = averageMonthlySpend(d.transactions.filter((t) => t.date < `${prev}-01`), addMonthKey(prev, -1));
  const showSummary = isCurrent && (d.settings.summarySeenFor ?? '') < prev &&
    (prevTotals.incomeCents > 0 || prevTotals.expenseCents > 0 || prevSaved !== 0);
  const salary = d.settings.salary;
  const pay = salary && nextPayday(salary, today);
  const payThisMonth = isCurrent && pay && monthOf(pay) === month;
  const recent = d.transactions
    .filter((t) => t.type === 'expense' && monthOf(t.date) === month)
    .slice(0, 5);
  const isNew = d.transactions.length === 0 && d.savings.length === 0 && !salary;

  const levels = d.budgets.map((b) =>
    budgetStatus(b.id === OVERALL_BUDGET_ID ? totals.expenseCents : spend.get(b.id) ?? 0, b.amountCents).level);
  const over = levels.filter((l) => l === 'over').length;
  const near = levels.filter((l) => l === 'near').length;
  const backupDays = d.settings.lastBackupAt
    ? (Date.now() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000
    : Infinity;
  const label = isCurrent ? 'this month' : `in ${formatMonth(month).split(' ')[0]}`;

  return (
    <div className="stack">
      <MonthPicker />

      <section className="hero" aria-label="Money left">
        <p className="hero-label">{left < 0 ? `Overspent ${label}` : `Left ${label}`}
          <InfoTip label="left this month">{isCurrent ? "This month's" : "That month's"} income, minus its expenses and what you saved or invested. Earlier months don't count here.</InfoTip>
        </p>
        <p className={`hero-value${left < 0 ? ' negative' : ''}`}>{d.money(Math.abs(left))}</p>
        <div className="hero-bar" role="img" aria-label={`${Math.round(usedRatio * 100)}% of income spent`}>
          <span style={{ width: `${Math.min(usedRatio, 1) * 100}%` }} />
        </div>
        {payThisMonth && <p className="hero-note">Salary of {d.money(salary.amountCents)} expected on {formatDay(pay)}. It isn't counted until then.</p>}
      </section>

      <section className="stats" aria-label="This month">
        <Link to="/income"><span className="muted stat-label">Income<ChevronRight size={14} aria-hidden /></span><strong>{d.money(totals.incomeCents)}</strong></Link>
        <Link to="/expenses"><span className="muted stat-label">Expenses<ChevronRight size={14} aria-hidden /></span><strong>{d.money(totals.expenseCents)}</strong></Link>
      </section>

      {/* Everything you own, split into what you can spend and what you've put aside. */}
      <section className="panel money" aria-label="Your money today">
        <div className="money-head">
          <span className="muted">Your money today</span>
          <strong className="money-total">{d.money(balance + totalSaved)}</strong>
        </div>
        {balance > 0 && totalSaved > 0 && (
          <div className="money-bar" role="img" aria-label={`${Math.round((balance / (balance + totalSaved)) * 100)}% to spend, ${Math.round((totalSaved / (balance + totalSaved)) * 100)}% saved and invested`}>
            <span className="spend" style={{ flexGrow: balance }} />
            <span className="saved" style={{ flexGrow: totalSaved }} />
          </div>
        )}
        <div className="money-row">
          <span className="key spend" aria-hidden />
          <span className="grow">To spend
            <InfoTip label="to spend">Your starting balance, plus all income, minus all expenses and money moved to savings or investments, up to today.</InfoTip>
          </span>
          <strong className={`num${balance < 0 ? ' negative-text' : ''}`}>{d.money(balance)}</strong>
        </div>
        <Link to="/savings" className="money-row">
          <span className="key saved" aria-hidden />
          <span className="grow">Saved & invested
            {(saved !== 0 || metals) && <span className="muted tiny">{[saved !== 0 && `${saved > 0 ? '+' : '-'}${d.money(Math.abs(saved))} ${label}`, metals].filter(Boolean).join(', ')}</span>}
          </span>
          <strong className="num">{d.money(totalSaved)}</strong>
          <ChevronRight size={16} aria-hidden className="muted" />
        </Link>
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

      {showSummary && (
        <section className="panel summary" aria-label={`${formatMonth(prev)} in review`}>
          <h2>{formatMonth(prev).split(' ')[0]} in review</h2>
          <dl className="insights">
            <div><dt>Spent</dt><dd>{d.money(prevTotals.expenseCents)}
              {before.months > 0 && prevTotals.expenseCents !== before.cents && (
                <small>{d.money(Math.abs(prevTotals.expenseCents - before.cents))} {prevTotals.expenseCents > before.cents ? 'more' : 'less'} than your average</small>
              )}</dd></div>
            {prevSpend[0] && <div><dt>Top category</dt><dd>{d.categoryById.get(prevSpend[0][0])?.name ?? 'Other'}, {d.money(prevSpend[0][1])}</dd></div>}
            <div><dt>Income</dt><dd>{d.money(prevTotals.incomeCents)}</dd></div>
            {prevSaved !== 0 && <div><dt>Saved & invested</dt><dd>{d.money(prevSaved)}</dd></div>}
            <div><dt>Left at the end</dt><dd>{d.money(prevTotals.incomeCents - prevTotals.expenseCents - prevSaved)}</dd></div>
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
          <span className="grow">{[over && `${over} over the limit`, near && `${near} near the limit`].filter(Boolean).join(', ')}</span>
          <ChevronRight size={18} aria-hidden />
        </Link>
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

    </div>
  );
}
