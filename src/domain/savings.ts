import type { Asset, ISODate, SavingsEntry } from './types';

export interface Holding {
  /** Coins or ounces held, in thousandths. */
  quantityMilli: number;
  /** What you paid for what you still hold. This is the value counted in your savings. */
  costCents: number;
}

export interface Metals {
  gold: Holding;
  silver: Holding;
  /** Profit (or loss) from sales so far: what you received minus what those pieces cost you. */
  gainCents: number;
}

/**
 * Gold and silver held on a date. Buying turns cash into metal, so savings don't change.
 * Selling uses the average price paid: selling above it adds the profit to your savings.
 */
export function metals(entries: SavingsEntry[], upTo: ISODate): Metals {
  const out: Metals = {
    gold: { quantityMilli: 0, costCents: 0 },
    silver: { quantityMilli: 0, costCents: 0 },
    gainCents: 0,
  };
  const ordered = entries
    .filter((e) => e.date <= upTo && (e.asset === 'gold' || e.asset === 'silver'))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  for (const e of ordered) {
    const h = out[e.asset];
    const qty = e.quantityMilli ?? 0;
    if (e.direction === 'in') {
      h.quantityMilli += qty;
      h.costCents += e.amountCents;
    } else {
      const sold = Math.min(qty, h.quantityMilli);
      const cost = h.quantityMilli ? Math.round((h.costCents * sold) / h.quantityMilli) : 0;
      h.quantityMilli -= sold;
      h.costCents -= cost;
      out.gainCents += e.amountCents - cost;
    }
  }
  return out;
}

/** Reads "2", "0.5" or "1.25" into thousandths, or null. Gold coins must be whole. */
export function parseQuantity(input: string, whole: boolean): number | null {
  const s = input.trim().replace(',', '.');
  if (!(whole ? /^\d+$/ : /^(\d+(\.\d{0,3})?|\.\d{1,3})$/).test(s)) return null;
  const milli = Math.round(Number(s) * 1000);
  return milli > 0 && Number.isSafeInteger(milli) ? milli : null;
}

export function formatQuantity(milli: number, asset: Asset): string {
  const n = Number((milli / 1000).toFixed(3));
  if (asset === 'gold') return `${n} ${n === 1 ? 'coin' : 'coins'}`;
  return `${n} oz`;
}
