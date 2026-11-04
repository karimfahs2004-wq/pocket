import { addMonthKey, addMonthsClamped } from './dates';
import type { ISODate, MonthKey, Salary } from './types';

/** The pay date in a given month. Payday 31 becomes the last day of a shorter month. */
export function paydayIn(month: MonthKey, payDay: number): ISODate {
  // Clamp through a month that has 31 days.
  const [y, m] = month.split('-').map(Number);
  const anchor = `${y}-01-${String(payDay).padStart(2, '0')}`;
  return addMonthsClamped(anchor, m - 1);
}

/** Months whose payday has arrived but haven't been handled yet. */
export function monthsDue(salary: Salary, today: ISODate): MonthKey[] {
  const out: MonthKey[] = [];
  let m = addMonthKey(salary.lastPaidMonth, 1);
  while (paydayIn(m, salary.payDay) <= today) {
    out.push(m);
    m = addMonthKey(m, 1);
  }
  return out;
}

/** The next pay date that hasn't happened yet. Money only counts once this date arrives. */
export function nextPayday(salary: Salary, today: ISODate): ISODate {
  let m = addMonthKey(salary.lastPaidMonth, 1);
  while (paydayIn(m, salary.payDay) <= today) m = addMonthKey(m, 1);
  return paydayIn(m, salary.payDay);
}
