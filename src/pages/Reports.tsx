import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Empty, MonthPicker, PageHead } from '../components/ui';
import { useAppData } from '../data/hooks';
import { addMonthKey, formatMonth, formatMonthShort, monthOf, todayISO } from '../domain/dates';
import { compareMonths, monthTotals, monthlySeries, spendByCategory } from '../domain/reports';

const axis = { fontSize: 12, fill: 'var(--muted)' };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 14 };

export default function Reports() {
  const d = useAppData();
  const thisMonth = monthOf(todayISO());
  const [month, setMonth] = useState(thisMonth);
  const [compareTo, setCompareTo] = useState<string | null>(null);

  const series = useMemo(
    () => monthlySeries(d.transactions, month, 6).map((m) => ({
      name: formatMonthShort(m.month),
      month: m.month,
      Income: m.incomeCents / 100,
      Expenses: m.expenseCents / 100,
    })),
    [d.transactions, month],
  );

  if (!d.ready) return null;
  if (!d.transactions.length) {
    return (
      <div className="stack">
        <PageHead title="Reports" />
        <Empty title="No data yet"><p className="muted">Charts appear after you add your first transactions.</p></Empty>
      </div>
    );
  }

  const name = (id: string) => d.categoryById.get(id)?.name ?? 'Uncategorized';
  const spend = [...spendByCategory(d.transactions, month).entries()].sort((a, b) => b[1] - a[1]);
  const total = monthTotals(d.transactions, month).expenseCents;
  const biggest = spend[0]?.[1] ?? 1;

  const other = compareTo ?? addMonthKey(month, -1);
  const rows = compareMonths(d.transactions, month, other);
  const otherTotal = monthTotals(d.transactions, other).expenseCents;
  const diff = total - otherTotal;
  const months = Array.from({ length: 24 }, (_, i) => addMonthKey(thisMonth, -i));
  const tick = (v: number) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v);
  const tip = (v: unknown) => d.money(Math.round(Number(v) * 100));

  return (
    <div className="stack">
      <PageHead title="Reports" />
      <MonthPicker month={month} onChange={(m) => { setMonth(m); setCompareTo(null); }} />

      <section className="panel">
        <h2>Expenses by category</h2>
        {spend.length ? (
          <>
            <p className="muted small">
              {d.money(total)} in total. {name(spend[0][0])} was the largest, at {Math.round((spend[0][1] / total) * 100)}%.
            </p>
            <ul className="rank">
              {spend.map(([id, cents]) => (
                <li key={id}>
                  <span className="rank-label"><span>{name(id)}</span><span className="num">{d.money(cents)}</span></span>
                  <span className="rank-track"><span style={{ width: `${(cents / biggest) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="muted">No expenses in {formatMonth(month)}.</p>}
      </section>

      <section className="panel">
        <h2>Income vs. expenses</h2>
        <p className="muted small">The six months up to {formatMonth(month)}</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={series} barGap={2} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={tick} width={48} />
              <Tooltip formatter={tip} contentStyle={tooltipStyle} cursor={{ fill: 'var(--wash)' }} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span className="ink">{v}</span>} />
              <Bar dataKey="Income" fill="var(--series-3)" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar dataKey="Expenses" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Spending trend</h2>
        <p className="muted small">Total expenses per month</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={tick} width={48} />
              <Tooltip formatter={tip} contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="Expenses" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--series-1)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details className="table-view">
          <summary>Show the numbers</summary>
          <table>
            <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Expenses</th></tr></thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.month}><td>{s.name}</td><td className="r num">{tip(s.Income)}</td><td className="r num">{tip(s.Expenses)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="panel">
        <h2>Compare months</h2>
        <div className="field">
          <label htmlFor="cmp">Compare {formatMonth(month)} with</label>
          <select id="cmp" value={other} onChange={(e) => setCompareTo(e.target.value)}>
            {[...new Set([other, ...months])].filter((m) => m !== month).map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
          </select>
        </div>
        <p className="muted small compare-line">
          {diff === 0 ? 'You spent the same in both months.'
            : `You spent ${d.money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} in ${formatMonth(month)} than in ${formatMonth(other)}.`}
        </p>
        {rows.length > 0 && (
          <table>
            <thead><tr><th>Category</th><th className="r">{formatMonthShort(month)}</th><th className="r">{formatMonthShort(other)}</th><th className="r">Change</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.categoryId}>
                  <td>{name(r.categoryId)}</td>
                  <td className="r num">{d.money(r.aCents)}</td>
                  <td className="r num">{d.money(r.bCents)}</td>
                  <td className="r num">{r.diffCents > 0 ? '+' : ''}{d.money(r.diffCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
