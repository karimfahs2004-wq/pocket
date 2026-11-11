import { addMonthKey, monthOf } from './dates';
import type { ISODate, MonthKey, Transaction } from './types';

export interface MonthTotals {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
}

export function monthTotals(txs: Transaction[], month: MonthKey): MonthTotals {
  const t: MonthTotals = { month, incomeCents: 0, expenseCents: 0 };
  for (const x of txs) {
    if (monthOf(x.date) !== month) continue;
    if (x.type === 'income') t.incomeCents += x.amountCents;
    else t.expenseCents += x.amountCents;
  }
  return t;
}

/** Oldest to newest, ending at `end`. */
export function monthlySeries(txs: Transaction[], end: MonthKey, count: number): MonthTotals[] {
  return Array.from({ length: count }, (_, i) =>
    monthTotals(txs, addMonthKey(end, i - count + 1)),
  );
}

/** Expense total per category id for one month. */
export function spendByCategory(txs: Transaction[], month: MonthKey): Map<string, number> {
  const out = new Map<string, number>();
  for (const x of txs) {
    if (x.type === 'expense' && monthOf(x.date) === month) {
      out.set(x.categoryId, (out.get(x.categoryId) ?? 0) + x.amountCents);
    }
  }
  return out;
}

/** Opening balance plus everything dated today or earlier. Future-dated entries don't count yet. */
export function currentBalance(txs: Transaction[], openingCents: number, today: ISODate): number {
  return txs.reduce((sum, x) => {
    if (x.date > today) return sum;
    return sum + (x.type === 'income' ? x.amountCents : -x.amountCents);
  }, openingCents);
}

/** Running expense total for each day of a month, from day 1 up to `lastDay`. */
export function cumulativeByDay(txs: Transaction[], month: MonthKey, lastDay: number): number[] {
  const perDay = new Array<number>(lastDay).fill(0);
  for (const x of txs) {
    if (x.type !== 'expense' || monthOf(x.date) !== month) continue;
    const day = Number(x.date.slice(8));
    if (day <= lastDay) perDay[day - 1] += x.amountCents;
  }
  let sum = 0;
  return perDay.map((v) => (sum += v));
}

/** Average across months with expenses, up to and including `upTo`. */
export function averageMonthlySpend(txs: Transaction[], upTo: MonthKey): { cents: number; months: number } {
  const byMonth = new Map<MonthKey, number>();
  for (const x of txs) {
    const m = monthOf(x.date);
    if (x.type === 'expense' && m <= upTo) byMonth.set(m, (byMonth.get(m) ?? 0) + x.amountCents);
  }
  const total = [...byMonth.values()].reduce((a, b) => a + b, 0);
  return { cents: byMonth.size ? Math.round(total / byMonth.size) : 0, months: byMonth.size };
}
