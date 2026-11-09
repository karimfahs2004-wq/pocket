import { monthOf } from './dates';
import type { Asset, ISODate, MonthKey, SavingsEntry } from './types';

const signed = (e: SavingsEntry) => (e.direction === 'in' ? e.amountCents : -e.amountCents);

/** Money moved into savings and investments, minus what came back, in one month. */
export function savedInMonth(entries: SavingsEntry[], month: MonthKey): number {
  return entries.filter((e) => monthOf(e.date) === month).reduce((s, e) => s + signed(e), 0);
}

/** The same, for everything dated today or earlier. */
export function savedUpTo(entries: SavingsEntry[], today: ISODate): number {
  return entries.filter((e) => e.date <= today).reduce((s, e) => s + signed(e), 0);
}

export interface Holding {
  /** Cash in savings, or what you've paid for the metal you still hold (net of sales). */
  cents: number;
  /** Coins or ounces held, in thousandths. */
  quantityMilli: number;
}

export function holdings(entries: SavingsEntry[]): Record<Asset, Holding> {
  const out: Record<Asset, Holding> = {
    cash: { cents: 0, quantityMilli: 0 },
    gold: { cents: 0, quantityMilli: 0 },
    silver: { cents: 0, quantityMilli: 0 },
  };
  for (const e of entries) {
    const sign = e.direction === 'in' ? 1 : -1;
    out[e.asset].cents += sign * e.amountCents;
    out[e.asset].quantityMilli += sign * (e.quantityMilli ?? 0);
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
