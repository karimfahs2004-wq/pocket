import { addDays, addMonthsClamped } from './dates';
import type { Frequency, ISODate, RecurringRule } from './types';

/** The nth occurrence, always worked out from the start date so day 31 survives short months. */
export function occurrenceAt(start: ISODate, freq: Frequency, n: number): ISODate {
  if (freq === 'weekly') return addDays(start, 7 * n);
  return addMonthsClamped(start, freq === 'monthly' ? n : 12 * n);
}

export function firstOnOrAfter(start: ISODate, freq: Frequency, date: ISODate): ISODate {
  let n = 0;
  let d = start;
  while (d < date) d = occurrenceAt(start, freq, ++n);
  return d;
}

/** Occurrences from the rule's nextDue up to and including `until`. */
export function occurrencesThrough(
  rule: Pick<RecurringRule, 'startDate' | 'frequency' | 'nextDue'>,
  until: ISODate,
): ISODate[] {
  const out: ISODate[] = [];
  let d = rule.nextDue;
  while (d <= until) {
    out.push(d);
    d = firstOnOrAfter(rule.startDate, rule.frequency, addDays(d, 1));
  }
  return out;
}

export interface UpcomingPayment {
  rule: RecurringRule;
  date: ISODate;
}

/** Scheduled payments after today, up to `until`, soonest first. Paused rules are left out. */
export function upcomingPayments(
  rules: RecurringRule[],
  today: ISODate,
  until: ISODate,
  type: RecurringRule['type'] = 'expense',
): UpcomingPayment[] {
  return rules
    .filter((r) => !r.paused && r.type === type)
    .flatMap((rule) =>
      occurrencesThrough(rule, until)
        .filter((date) => date > today)
        .map((date) => ({ rule, date })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
