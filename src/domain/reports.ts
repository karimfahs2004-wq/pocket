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

export interface ComparisonRow {
  categoryId: string;
  aCents: number;
  bCents: number;
  diffCents: number;
}

/** Spending per category in month `a` vs month `b`; diff is a minus b. Largest change first. */
export function compareMonths(txs: Transaction[], a: MonthKey, b: MonthKey): ComparisonRow[] {
  const sa = spendByCategory(txs, a);
  const sb = spendByCategory(txs, b);
  return [...new Set([...sa.keys(), ...sb.keys()])]
    .map((categoryId) => {
      const aCents = sa.get(categoryId) ?? 0;
      const bCents = sb.get(categoryId) ?? 0;
      return { categoryId, aCents, bCents, diffCents: aCents - bCents };
    })
    .sort((x, y) => Math.abs(y.diffCents) - Math.abs(x.diffCents));
}
