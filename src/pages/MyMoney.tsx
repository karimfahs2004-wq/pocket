import { ChevronRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AmountField } from '../components/AmountField';
import { BackButton, Sheet, primeKeyboard, useUi } from '../components/ui';
import { useCountUp } from '../components/useCountUp';
import { useAppData } from '../data/hooks';
import { updateSettings } from '../data/repo';
import { addMonthKey, formatDay, formatMonth, formatMonthShort, monthOf, todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import { currentBalance, monthTotals, monthlySeries } from '../domain/reports';
import { nextPayday } from '../domain/salary';
import { formatQuantity, metals } from '../domain/savings';

function StartingSheet({ current, onClose }: { current: number; onClose: () => void }) {
  const { toast } = useUi();
  const [value, setValue] = useState(current ? centsToInput(current) : '');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(value || '0', true);
    if (cents === null) return setError('Enter an amount, like 500 or -50.');
    await updateSettings({ openingBalanceCents: cents });
    toast({ message: 'Starting money saved', undo: () => void updateSettings({ openingBalanceCents: current }) });
    onClose();
  };
  return (
    <Sheet title="Starting money" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <AmountField label="Money you had before using Pocket" large autoFocus allowNegative value={value} onChange={setValue} error={error} />
        <p className="hint">Count all the money you had: wallet, bank and savings. Leave out gold and silver, and add those under Gold & silver.</p>
        <div className="sheet-actions"><button className="btn primary wide">Save starting money</button></div>
      </form>
    </Sheet>
  );
}

/** Everything private in one place: what you own, what comes in, and how each month ended. */
export default function MyMoney() {
  const d = useAppData();
  const [editStart, setEditStart] = useState(false);
  const today = todayISO();
  const month = monthOf(today);
  // Savings are automatic: everything you received minus everything you spent.
  // Gold and silver are part of it, counted at the price you paid.
  const m = metals(d.savings, today);
  const total = currentBalance(d.transactions, d.settings.openingBalanceCents, today) + m.gainCents;
  const metal = m.gold.costCents + m.silver.costCents;
  const cash = total - metal;
  const count = useCountUp(d.ready ? total : 0);
  if (!d.ready) return null;

  const holding = [
    m.gold.quantityMilli > 0 && `${formatQuantity(m.gold.quantityMilli, 'gold')} of gold`,
    m.silver.quantityMilli > 0 && `${formatQuantity(m.silver.quantityMilli, 'silver')} of silver`,
  ].filter(Boolean).join(', ');

  const t = monthTotals(d.transactions, month);
  const savedNow = t.incomeCents - t.expenseCents;
  const salary = d.settings.salary;
  const pay = salary && nextPayday(salary, today);
  const history = monthlySeries(d.transactions, addMonthKey(month, -1), 5).reverse()
    .filter((x) => x.incomeCents || x.expenseCents);

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line"><BackButton /><h1>My money</h1></div>
      </header>

      <section className="hero" aria-label="Total savings" data-settled={count.settled || undefined}>
        <p className="hero-label">Total savings</p>
        <p className={`hero-value${total < 0 ? ' negative' : ''}`}>{d.money(count.value)}</p>
        {cash > 0 && metal > 0 && (
          <div className="money-bar" role="img" aria-label={`${Math.round((cash / total) * 100)}% cash, ${Math.round((metal / total) * 100)}% gold and silver`}>
            <span className="spend" style={{ flexGrow: cash }} />
            <span className="saved" style={{ flexGrow: metal }} />
          </div>
        )}
        <p className="hero-note">Everything you've received minus everything you've spent. Calculated automatically.</p>
      </section>

      <section className="panel rows" aria-label="What you own">
        <div className="money-row">
          <span className="key spend" aria-hidden />
          <span className="grow">Cash<span className="muted tiny">Savings you hold as money</span></span>
          <strong className={`num${cash < 0 ? ' negative-text' : ''}`}>{d.money(cash)}</strong>
        </div>
        <Link to="/savings" className="money-row">
          <span className="key saved" aria-hidden />
          <span className="grow">Gold & silver<span className="muted tiny">{holding ? `${holding}, at the price you paid` : 'Add gold coins or silver ounces you buy'}</span></span>
          <strong className="num">{d.money(metal)}</strong>
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
        {salary && pay && monthOf(pay) === month && (
          <p className="muted small">Salary of {d.money(salary.amountCents)} is expected on {formatDay(pay)}. It isn't counted until then.</p>
        )}
      </section>

      <section className="panel rows" aria-label="Manage">
        <Link to="/income" className="money-row first">
          <span className="grow">Income & salary<span className="muted tiny">{salary ? `${d.money(salary.amountCents)} a month, paid on day ${salary.payDay}` : 'Set your salary or add other income'}</span></span>
          <ChevronRight size={16} aria-hidden className="muted" />
        </Link>
        <button className="money-row" onClick={() => { primeKeyboard(); setEditStart(true); }}>
          <span className="grow">Starting money<span className="muted tiny">What you had before using Pocket</span></span>
          <strong className="num">{d.money(d.settings.openingBalanceCents)}</strong>
          <ChevronRight size={16} aria-hidden className="muted" />
        </button>
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

      {editStart && <StartingSheet current={d.settings.openingBalanceCents} onClose={() => setEditStart(false)} />}
    </div>
  );
}
