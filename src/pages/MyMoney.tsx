import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BackButton, useUi } from '../components/ui';
import { useCountUp } from '../components/useCountUp';
import { useAppData } from '../data/hooks';
import { addMonthKey, formatMonth, formatMonthShort, monthOf, todayISO } from '../domain/dates';
import { currentBalance, monthTotals, monthlySeries } from '../domain/reports';
import { formatQuantity, metals } from '../domain/savings';

export default function MyMoney() {
  const d = useAppData();
  const { newTransaction } = useUi();
  const today = todayISO();
  const month = monthOf(today);
  // Savings are automatic: everything you received minus everything you spent.
  // Gold and silver are part of it, counted at the price you paid.
  const m = metals(d.savings, today);
  const total = currentBalance(d.transactions, 0, today) + m.gainCents;
  // Gold and silver are kept as counts only; what you paid for them has left your savings.
  const cash = total - (m.gold.costCents + m.silver.costCents);
  const count = useCountUp(d.ready ? cash : 0);
  if (!d.ready) return null;

  const holding = [
    m.gold.quantityMilli > 0 && `${formatQuantity(m.gold.quantityMilli, 'gold')} of gold`,
    m.silver.quantityMilli > 0 && `${formatQuantity(m.silver.quantityMilli, 'silver')} of silver`,
  ].filter(Boolean).join(', ');

  const t = monthTotals(d.transactions, month);
  const savedNow = t.incomeCents - t.expenseCents;
  const history = monthlySeries(d.transactions, addMonthKey(month, -1), 5).reverse()
    .filter((x) => x.incomeCents || x.expenseCents);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line"><BackButton /><h1>My money</h1></div>
      </header>

      <section className="hero" aria-label="Savings" data-settled={count.settled || undefined}>
        <p className="hero-label">Savings</p>
        <p className={`hero-value${cash < 0 ? ' negative' : ''}`}>{d.money(count.value)}</p>
        {holding && <p className="hero-metals">+ {holding}</p>}
        <p className="hero-note">Everything you've received minus everything you've spent, including what you paid for gold and silver. Calculated automatically.</p>
      </section>

      <section className="panel rows" aria-label="Gold and silver">
        <Link to="/savings" className="money-row">
          <span className="key saved" aria-hidden />
          <span className="grow">Gold & silver<span className="muted tiny">{holding ? `${holding}. Buy, sell or see history` : 'Add gold coins or silver ounces you buy'}</span></span>
          <ChevronRight size={16} aria-hidden className="muted" />
        </Link>
      </section>

      <section className="panel" aria-label={formatMonth(month)}>
        <h2>{formatMonth(month)}</h2>
        <dl className="sum">
          <div><dt>Income received</dt><dd className="num">{d.money(t.incomeCents)}</dd></div>
          <div><dt>Spent</dt><dd className="num">-{d.money(t.expenseCents)}</dd></div>
          <div className="sum-total"><dt>{savedNow < 0 ? 'Overspent this month' : 'Saved this month'}</dt><dd className={`num${savedNow < 0 ? ' negative-text' : ''}`}>{d.money(Math.abs(savedNow))}</dd></div>
        </dl>
        <button className="btn primary start" onClick={() => newTransaction('income')}><Plus size={15} aria-hidden />Add income</button>
      </section>

      <section className="panel rows" aria-label="Manage">
        <Link to="/income" className="money-row first">
          <span className="grow">All income<span className="muted tiny">Everything you've received, month by month</span></span>
          <ChevronRight size={16} aria-hidden className="muted" />
        </Link>
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h2>Earlier months</h2>
          <table>
            <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Spent</th><th className="r">Saved</th></tr></thead>
            <tbody>
              {history.map((x) => {
                const l = x.incomeCents - x.expenseCents;
                return (
                  <tr key={x.month}>
                    <td>{formatMonthShort(x.month)}</td>
                    <td className="r num">{d.money(x.incomeCents)}</td>
                    <td className="r num">{d.money(x.expenseCents)}</td>
                    <td className={`r num${l < 0 ? ' negative-text' : ''}`}>{d.money(l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Saved is income minus spending for that month.</p>
        </section>
      )}

    </div>
  );
}
