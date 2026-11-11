import { ChevronRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AmountField } from '../components/AmountField';
import { BackButton, Sheet, primeKeyboard, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { updateSettings } from '../data/repo';
import { addMonthKey, formatDay, formatMonth, formatMonthShort, monthOf, todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import { currentBalance, monthTotals, monthlySeries } from '../domain/reports';
import { nextPayday } from '../domain/salary';
import { formatQuantity, holdings, savedInMonth, savedUpTo } from '../domain/savings';

function StartingSheet({ current, onClose }: { current: number; onClose: () => void }) {
  const { toast } = useUi();
  const [value, setValue] = useState(current ? centsToInput(current) : '');
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(value || '0', true);
    if (cents === null) return setError('Enter an amount, like 500 or -50.');
    await updateSettings({ openingBalanceCents: cents });
    toast({ message: 'Starting cash saved', undo: () => void updateSettings({ openingBalanceCents: current }) });
    onClose();
  };
  return (
    <Sheet title="Starting cash" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <AmountField label="Cash you had before using Pocket" large autoFocus allowNegative value={value} onChange={setValue} error={error} />
        <p className="hint">Count the money you can spend: wallet and bank. Leave out savings, gold and silver, and add those under Savings & investments.</p>
        <div className="sheet-actions"><button className="btn primary wide">Save starting cash</button></div>
      </form>
    </Sheet>
  );
}

/** Everything private in one place: what you own, what comes in, and how each month ended. */
export default function MyMoney() {
  const d = useAppData();
  const [editStart, setEditStart] = useState(false);
  if (!d.ready) return null;

  const today = todayISO();
  const month = monthOf(today);
  const saved = savedUpTo(d.savings, today);
  const cash = currentBalance(d.transactions, d.settings.openingBalanceCents, today) - saved;
  const total = cash + saved;
  const h = holdings(d.savings);
  const holding = [
    h.cash.cents > 0 && `${d.money(h.cash.cents)} cash savings`,
    h.gold.quantityMilli > 0 && `${formatQuantity(h.gold.quantityMilli, 'gold')} of gold`,
    h.silver.quantityMilli > 0 && `${formatQuantity(h.silver.quantityMilli, 'silver')} of silver`,
  ].filter(Boolean).join(', ');

  const t = monthTotals(d.transactions, month);
  const savedNow = savedInMonth(d.savings, month);
  const left = t.incomeCents - t.expenseCents - savedNow;
  const salary = d.settings.salary;
  const pay = salary && nextPayday(salary, today);
  const history = monthlySeries(d.transactions, addMonthKey(month, -1), 5).reverse()
    .filter((x) => x.incomeCents || x.expenseCents || savedInMonth(d.savings, x.month));

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line"><BackButton /><h1>My money</h1></div>
      </header>

      <section className="hero" aria-label="Total money">
        <p className="hero-label">Total money</p>
        <p className={`hero-value${total < 0 ? ' negative' : ''}`}>{d.money(total)}</p>
        {cash > 0 && saved > 0 && (
          <div className="money-bar" role="img" aria-label={`${Math.round((cash / total) * 100)}% cash, ${Math.round((saved / total) * 100)}% savings and investments`}>
            <span className="spend" style={{ flexGrow: cash }} />
            <span className="saved" style={{ flexGrow: saved }} />
          </div>
        )}
        <p className="hero-note">Cash plus savings and investments, today.</p>
      </section>

      <section className="panel rows" aria-label="What you own">
        <div className="money-row">
          <span className="key spend" aria-hidden />
          <span className="grow">Cash<span className="muted tiny">Money you can spend now</span></span>
          <strong className={`num${cash < 0 ? ' negative-text' : ''}`}>{d.money(cash)}</strong>
        </div>
        <Link to="/savings" className="money-row">
          <span className="key saved" aria-hidden />
          <span className="grow">Savings & investments<span className="muted tiny">{holding || 'Cash savings, gold coins, silver ounces'}</span></span>
          <strong className="num">{d.money(saved)}</strong>
          <ChevronRight size={16} aria-hidden className="muted" />
        </Link>
      </section>

      <section className="panel" aria-label={formatMonth(month)}>
        <h2>{formatMonth(month)}</h2>
        <dl className="sum">
          <div><dt>Income received</dt><dd className="num">{d.money(t.incomeCents)}</dd></div>
          <div><dt>Spent</dt><dd className="num">-{d.money(t.expenseCents)}</dd></div>
          {savedNow !== 0 && <div><dt>{savedNow > 0 ? 'Moved to savings & investments' : 'Taken out of savings'}</dt><dd className="num">{savedNow > 0 ? '-' : '+'}{d.money(Math.abs(savedNow))}</dd></div>}
          <div className="sum-total"><dt>{left < 0 ? 'Short this month' : 'Left from this month'}</dt><dd className={`num${left < 0 ? ' negative-text' : ''}`}>{d.money(Math.abs(left))}</dd></div>
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
          <span className="grow">Starting cash<span className="muted tiny">What you had before using Pocket</span></span>
          <strong className="num">{d.money(d.settings.openingBalanceCents)}</strong>
          <ChevronRight size={16} aria-hidden className="muted" />
        </button>
      </section>

      {history.length > 0 && (
        <section className="panel">
          <h2>Earlier months</h2>
          <table>
            <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Spent</th><th className="r">Left</th></tr></thead>
            <tbody>
              {history.map((x) => {
                const l = x.incomeCents - x.expenseCents - savedInMonth(d.savings, x.month);
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
          <p className="muted small">Left is income minus spending and what you moved to savings.</p>
        </section>
      )}

      {editStart && <StartingSheet current={d.settings.openingBalanceCents} onClose={() => setEditStart(false)} />}
    </div>
  );
}
