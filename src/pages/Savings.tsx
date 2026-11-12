import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AmountField } from '../components/AmountField';
import { BackButton, primeKeyboard, Sheet, useUi } from '../components/ui';
import { useAppData } from '../data/hooks';
import { deleteSavings, restoreSavings, saveSavings } from '../data/repo';
import { formatDay, todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import { formatQuantity, metals, parseQuantity } from '../domain/savings';
import type { Asset, SavingsEntry } from '../domain/types';

const NAMES: Record<Asset, string> = { gold: 'Gold', silver: 'Silver' };
const verb = (asset: Asset, direction: 'in' | 'out') => `${direction === 'in' ? 'Buy' : 'Sell'} ${asset}`;
const FAR = '9999-12-31';

function EntrySheet({ asset, direction, entry, onClose }: {
  asset: Asset; direction: 'in' | 'out'; entry?: SavingsEntry; onClose: () => void;
}) {
  const d = useAppData();
  const { toast } = useUi();
  const unit = asset === 'gold' ? 'coins' : 'ounces';
  const [qty, setQty] = useState(entry?.quantityMilli ? String(entry.quantityMilli / 1000) : '');
  const [amount, setAmount] = useState(entry ? centsToInput(entry.amountCents) : '');
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // You can't sell more than you have (an edited entry's own amount counts as yours).
  const have = metals(d.savings.filter((e) => e.id !== entry?.id), FAR)[asset];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    const milli = parseQuantity(qty, asset === 'gold');
    const next: Record<string, string> = {};
    if (!milli) next.qty = asset === 'gold' ? 'Enter a whole number of coins, like 1.' : 'Enter ounces, like 1 or 0.5.';
    if (!cents) next.amount = 'Enter an amount above 0.';
    if (direction === 'out' && milli && milli > have.quantityMilli) next.qty = `You have ${formatQuantity(have.quantityMilli, asset)}.`;
    if (!date) next.date = 'Choose a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const id = await saveSavings({
      ...entry, asset, direction, amountCents: cents!, quantityMilli: milli!, date, notes: notes.trim() || undefined,
    });
    toast(entry
      ? { message: 'Changes saved', undo: () => void restoreSavings(entry) }
      : { message: 'Saved', undo: () => void deleteSavings(id) });
    onClose();
  };

  const remove = async () => {
    await deleteSavings(entry!.id);
    toast({ message: 'Entry deleted', undo: () => void restoreSavings(entry!) });
    onClose();
  };

  return (
    <Sheet title={entry ? `Edit: ${verb(asset, direction).toLowerCase()}` : verb(asset, direction)} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="sv-qty">How many {unit}</label>
          <input id="sv-qty" inputMode="decimal" autoComplete="off" value={qty} onChange={(e) => setQty(e.target.value)}
            autoFocus={!entry} data-autofocus={!entry || undefined} aria-invalid={!!errors.qty} placeholder={asset === 'gold' ? '1' : '1 or 0.5'} />
          {errors.qty && <p className="error">{errors.qty}</p>}
          {direction === 'out' && <p className="hint">You have {formatQuantity(have.quantityMilli, asset)}.</p>}
        </div>
        <AmountField label={direction === 'in' ? 'Total price paid' : 'Total amount received'} value={amount} onChange={setAmount} error={errors.amount} />
        <div className="field">
          <label htmlFor="sv-date">Date</label>
          <input id="sv-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
          {errors.date && <p className="error">{errors.date}</p>}
        </div>
        <div className="field">
          <label htmlFor="sv-notes">Notes (optional)</label>
          <input id="sv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shop, coin type" />
        </div>
        <p className="hint">
          {direction === 'in'
            ? 'The price comes out of your cash. Your total savings stay the same, because the metal is counted at the price you paid.'
            : 'The money goes back to your cash. If you sell for more than you paid, the profit is added to your savings.'}
        </p>
        <div className="sheet-actions">
          <button className="btn primary wide">{entry ? 'Save changes' : verb(asset, direction)}</button>
          {entry && <button type="button" className="btn ghost-danger wide" onClick={remove}>Delete entry</button>}
        </div>
      </form>
    </Sheet>
  );
}

export default function Savings() {
  const d = useAppData();
  const [sheet, setSheet] = useState<{ asset: Asset; direction: 'in' | 'out'; entry?: SavingsEntry } | null>(null);
  if (!d.ready) return null;

  const m = metals(d.savings, FAR);
  const open = (s: NonNullable<typeof sheet>) => { if (!s.entry) primeKeyboard(); setSheet(s); };

  const Card = ({ asset }: { asset: Asset }) => {
    const x = m[asset];
    const has = x.quantityMilli > 0;
    return (
      <section className="panel asset">
        <div className="asset-head">
          <span className={`asset-mark ${asset}`} aria-hidden />
          <h2 className="grow">{NAMES[asset]}</h2>
        </div>
        <p className="asset-value">{formatQuantity(x.quantityMilli, asset)}</p>
        <p className="muted small">{has ? `Counted as ${d.money(x.costCents)}, the price you paid` : 'None yet'}</p>
        <div className="row-actions start">
          <button className="btn small primary" onClick={() => open({ asset, direction: 'in' })}><Plus size={15} aria-hidden />Buy</button>
          {has && <button className="btn small" onClick={() => open({ asset, direction: 'out' })}>Sell</button>}
        </div>
      </section>
    );
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line">
          <BackButton />
          <h1>Gold & silver</h1>
        </div>
      </header>

      <section className="total-saved" aria-label="Gold and silver value">
        <span className="muted">In your savings as</span>
        <strong>{d.money(m.gold.costCents + m.silver.costCents)}</strong>
        <span className="muted small">Counted at the price you paid, not today's market price.</span>
      </section>

      <div className="asset-pair">
        <Card asset="gold" />
        <Card asset="silver" />
      </div>

      <section className="panel">
        <h2>History</h2>
        {d.savings.length ? (
          <ul className="plain-list">
            {d.savings.map((e) => (
              <li key={e.id} className="tx-item">
                <button className="tx-row" tabIndex={-1} aria-hidden onClick={() => setSheet({ asset: e.asset, direction: e.direction, entry: e })}>
                  <span className={`asset-mark small ${e.asset}`} />
                  <span className="tx-main">
                    <span className="tx-name">{verb(e.asset, e.direction)}, {formatQuantity(e.quantityMilli ?? 0, e.asset)}</span>
                    <span className="tx-meta">{formatDay(e.date)}{e.notes ? `, ${e.notes}` : ''}</span>
                  </span>
                  <span className="tx-amount num">{d.money(e.amountCents)}</span>
                </button>
                <button className="icon-btn tx-edit" onClick={() => setSheet({ asset: e.asset, direction: e.direction, entry: e })} aria-label={`Edit ${verb(e.asset, e.direction)}, ${formatDay(e.date)}`}>
                  <Pencil size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Nothing yet. Tap Buy above when you buy gold or silver.</p>}
      </section>

      {sheet && <EntrySheet key={sheet.entry?.id ?? sheet.asset + sheet.direction} {...sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
