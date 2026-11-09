import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TransactionRow } from '../components/TransactionRow';
import { Dot, Empty, MonthPicker, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { addMonthKey, formatMonth, formatMonthShort, monthOf, todayISO } from '../domain/dates';
import { averageMonthlySpend, monthTotals, monthlySeries, spendByCategory } from '../domain/reports';

const WINDOW = 6;
const axis = { fontSize: 12, fill: 'var(--muted)' };
const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontSize: 14 };

export default function Reports() {
  const d = useAppData();
  const { month, setMonth } = useUi();
  const thisMonth = monthOf(todayISO());
  const [selected, setSelected] = useState<string | null>(null);

  // The chart stays put when you pick a month inside it, and moves only when you leave it.
  const [end, setEnd] = useState(month > thisMonth ? month : thisMonth);
  if (month > end) setEnd(month);
  else if (month <= addMonthKey(end, -WINDOW)) setEnd(addMonthKey(month, WINDOW - 1));

  const [lastMonth, setLastMonth] = useState(month);
  if (lastMonth !== month) { setLastMonth(month); setSelected(null); }

  const series = useMemo(() => monthlySeries(d.transactions, end, WINDOW), [d.transactions, end]);

  if (!d.ready) return null;
  if (!d.transactions.length) {
    return (
      <div className="stack">
        <MonthPicker />
        <Empty title="No data yet"><p className="muted">Reports appear after you add your first expenses.</p></Empty>
      </div>
    );
  }

  const name = (id: string) => d.categoryById.get(id)?.name ?? 'Uncategorized';
  const slot = (id: string) => d.categoryById.get(id)?.colorSlot ?? 6;
  const totals = monthTotals(d.transactions, month);
  const total = totals.expenseCents;
  const spend = [...spendByCategory(d.transactions, month).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, cents]) => ({ id, name: name(id), cents, pct: total ? (cents / total) * 100 : 0 }));
  const pct = (p: number) => (p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`);

  const avg = averageMonthlySpend(d.transactions, month);
  const prev = addMonthKey(month, -1);
  const prevTotal = monthTotals(d.transactions, prev).expenseCents;
  const diff = total - prevTotal;
  const active = spend.find((s) => s.id === selected);
  const activeItems = active
    ? d.transactions.filter((t) => t.type === 'expense' && t.categoryId === active.id && monthOf(t.date) === month)
    : [];
  const tick = (v: number) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v / 100);

  return (
    <div className="stack">
      <MonthPicker />

      <section className="panel" aria-label="Insights">
        <h2>Insights</h2>
        <dl className="insights">
          <div><dt>Total expenses</dt><dd>{d.money(total)}</dd></div>
          <div><dt>Highest category</dt><dd>{spend[0] ? `${spend[0].name}, ${d.money(spend[0].cents)}` : 'None yet'}</dd></div>
          <div>
            <dt>Average per month</dt>
            <dd>{avg.months ? d.money(avg.cents) : 'None yet'}{avg.months > 0 && <small>{avg.months} {avg.months === 1 ? 'month' : 'months'} with expenses</small>}</dd>
          </div>
          <div><dt>Income spent</dt><dd>{totals.incomeCents ? `${Math.round((total / totals.incomeCents) * 100)}%` : 'No income this month'}</dd></div>
          <div>
            <dt>Compared with {formatMonthShort(prev)}</dt>
            <dd>{diff === 0 ? 'No change' : `${d.money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'}`}
              {prevTotal > 0 && diff !== 0 && <small>{diff > 0 ? '+' : '-'}{Math.round((Math.abs(diff) / prevTotal) * 100)}%</small>}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Spending by category</h2>
        {spend.length ? (
          <>
            <p className="muted small">Tap a category to see its expenses.</p>
            <div className="donut">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={spend} dataKey="cents" nameKey="name" innerRadius="66%" outerRadius="96%"
                    startAngle={90} endAngle={-270} paddingAngle={spend.length > 1 ? 2 : 0} stroke="none"
                    isAnimationActive={false} rootTabIndex={-1}
                    onClick={(_, i) => { const id = spend[i].id; setSelected(selected === id ? null : id); }}
                  >
                    {spend.map((s) => (
                      <Cell key={s.id} fill={`var(--series-${slot(s.id) + 1})`} opacity={!selected || selected === s.id ? 1 : 0.28} tabIndex={-1} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span>{active ? active.name : 'Total'}</span>
                <strong>{d.money(active ? active.cents : total)}</strong>
                {active && <span>{pct(active.pct)}</span>}
              </div>
            </div>
            <ul className="cat-list">
              {spend.map((s) => (
                <li key={s.id}>
                  <button aria-pressed={selected === s.id} onClick={() => setSelected(selected === s.id ? null : s.id)}>
                    <Dot slot={slot(s.id)} />
                    <span className="grow">{s.name}</span>
                    <span className="muted small num">{pct(s.pct)}</span>
                    <span className="num cat-amt">{d.money(s.cents)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {active && (
              <div className="drill">
                <h3>{active.name} in {formatMonth(month).split(' ')[0]}</h3>
                <ul className="plain-list">
                  {activeItems.map((t) => (
                    <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : <p className="muted">No expenses in {formatMonth(month)}.</p>}
      </section>

      <section className="panel">
        <h2>Monthly spending</h2>
        <p className="muted small">Tap a bar to open that month.</p>
        <div className="chart">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={series} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="month" tickFormatter={formatMonthShort} tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={tick} width={46} />
              <Tooltip
                formatter={(v) => [d.money(Number(v)), 'Spent']}
                labelFormatter={(m) => formatMonth(String(m))}
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--wash)' }}
              />
              <Bar dataKey="expenseCents" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false} cursor="pointer"
                onClick={(p) => setMonth((p as unknown as { month: string }).month)}>
                {series.map((m) => <Cell key={m.month} fill={m.month === month ? 'var(--series-1)' : 'var(--bar-muted)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel">
        <h2>Income vs. expenses</h2>
        <table>
          <thead><tr><th>Month</th><th className="r">Income</th><th className="r">Spent</th><th className="r">Left</th></tr></thead>
          <tbody>
            {[...series].reverse().map((m) => {
              const left = m.incomeCents - m.expenseCents;
              return (
                <tr key={m.month} className={m.month === month ? 'current' : undefined}>
                  <td>{formatMonthShort(m.month)}</td>
                  <td className="r num">{d.money(m.incomeCents)}</td>
                  <td className="r num">{d.money(m.expenseCents)}</td>
                  <td className={`r num${left < 0 ? ' negative-text' : ''}`}>{d.money(left)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
