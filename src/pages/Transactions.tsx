import { Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TransactionRow } from '../components/TransactionRow';
import { Empty, PageHead, Segmented, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { formatDayFull } from '../domain/dates';

type TypeFilter = 'all' | 'income' | 'expense';

export default function Transactions() {
  const d = useAppData();
  const { newTransaction } = useUi();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.transactions.filter((t) =>
      (type === 'all' || t.type === type) &&
      (!category || t.categoryId === category) &&
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!q || t.name.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)),
    );
  }, [d.transactions, query, type, category, from, to]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [filtered]);

  if (!d.ready) return null;
  const active = [type !== 'all', !!category, !!from, !!to].filter(Boolean).length;
  const clear = () => { setQuery(''); setType('all'); setCategory(''); setFrom(''); setTo(''); };
  const options = d.categories.filter((c) => type === 'all' || c.kind === type);

  return (
    <div className="stack">
      <PageHead title="Transactions" />
      <div className="search-row">
        <label className="search">
          <Search size={18} aria-hidden />
          <input type="search" placeholder="Search name or notes" aria-label="Search transactions" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="btn" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={18} aria-hidden />Filter{active > 0 && ` (${active})`}
        </button>
      </div>

      {showFilters && (
        <section className="panel form" aria-label="Filters">
          <Segmented label="Type" value={type} onChange={(t) => { setType(t); setCategory(''); }} options={[
            { value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' },
          ]} />
          <div className="field">
            <label htmlFor="f-cat">Category</label>
            <select id="f-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="two">
            <div className="field"><label htmlFor="f-from">From</label><input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label htmlFor="f-to">To</label><input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <button className="btn" onClick={clear}>Clear filters</button>
        </section>
      )}

      {groups.length === 0 ? (
        d.transactions.length === 0 ? (
          <Empty title="No transactions yet">
            <button className="btn primary" onClick={() => newTransaction()}>Add transaction</button>
          </Empty>
        ) : (
          <Empty title="No matching transactions">
            <button className="btn" onClick={clear}>Clear search and filters</button>
          </Empty>
        )
      ) : (
        groups.map(([date, items]) => (
          <section key={date} className="day">
            <h2 className="day-head">{formatDayFull(date)}</h2>
            <ul className="plain-list panel tight">
              {items.map((t) => (
                <TransactionRow key={t.id} tx={t} category={d.categoryById.get(t.categoryId)} money={d.money} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
