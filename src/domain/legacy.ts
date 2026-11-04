import { addDays, addMonthKey, addMonthsClamped, monthOf } from './dates';
import type { ISODate, Salary, Transaction } from './types';

/**
 * Upgrades data from the first version of Pocket, which had recurring payments.
 * Used once when the database upgrades, and whenever an old backup is restored.
 */
export interface LegacyRule {
  id: string;
  type: 'income' | 'expense';
  name: string;
  amountCents: number;
  categoryId: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate: ISODate;
  nextDue: ISODate;
  paused: boolean;
  notes?: string;
}
export type LegacyTransaction = Transaction & { recurringId?: string; occurrenceDate?: ISODate };

function occurrence(r: LegacyRule, n: number): ISODate {
  if (r.frequency === 'weekly') return addDays(r.startDate, 7 * n);
  return addMonthsClamped(r.startDate, r.frequency === 'monthly' ? n : 12 * n);
}

function dueDates(r: LegacyRule, today: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let n = 0, d = occurrence(r, 0); d <= today; d = occurrence(r, ++n)) {
    if (d >= r.nextDue) out.push(d);
  }
  return out;
}

const isSalary = (r: LegacyRule) =>
  r.type === 'income' && r.frequency === 'monthly' && !r.paused &&
  (r.categoryId === 'salary' || /salary/i.test(r.name));

export function migrateLegacy(
  rules: LegacyRule[],
  transactions: LegacyTransaction[],
  today: ISODate,
  newId: () => string,
): { added: Transaction[]; salary?: Salary; retired: LegacyRule[] } {
  // Payments that fell due before this upgrade still happened, so record them.
  const seen = new Set(transactions.map((t) => `${t.recurringId}|${t.occurrenceDate}`));
  const added: Transaction[] = [];
  for (const r of rules) {
    if (r.paused) continue;
    for (const date of dueDates(r, today)) {
      if (seen.has(`${r.id}|${date}`)) continue;
      added.push({
        id: newId(), type: r.type, name: r.name, amountCents: r.amountCents,
        categoryId: r.categoryId, date, ...(r.notes ? { notes: r.notes } : {}),
      });
    }
  }

  const rule = rules.find(isSalary);
  let salary: Salary | undefined;
  if (rule) {
    // The last month already handled: the one before the rule's next unpaid date.
    let next = rule.nextDue;
    for (const d of dueDates(rule, today)) next = addDays(d, 1);
    const lastHandled = next > rule.nextDue ? monthOf(addDays(next, -1)) : addMonthKey(monthOf(next), -1);
    salary = {
      amountCents: rule.amountCents,
      payDay: Number(rule.startDate.slice(8)),
      lastPaidMonth: lastHandled,
    };
  }
  return { added, salary, retired: rules };
}

/** Removes the fields only the old recurring feature used. */
export function stripLegacy(t: LegacyTransaction): Transaction {
  const { recurringId: _r, occurrenceDate: _o, ...rest } = t;
  return rest;
}
