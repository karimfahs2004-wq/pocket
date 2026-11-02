import type { ISODate, MonthKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const parts = (d: string) => d.split('-').map(Number);
const toUTC = (d: ISODate) => {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day));
};
const fromUTC = (d: Date): ISODate =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function todayISO(now = new Date()): ISODate {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const monthOf = (d: ISODate): MonthKey => d.slice(0, 7);

export function addDays(d: ISODate, n: number): ISODate {
  const u = toUTC(d);
  u.setUTCDate(u.getUTCDate() + n);
  return fromUTC(u);
}

export function addMonthKey(m: MonthKey, n: number): MonthKey {
  const [y, mo] = parts(m);
  const u = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}`;
}

/** Adds months and clamps to month end: Jan 31 + 1 month is Feb 28 (or 29). */
export function addMonthsClamped(d: ISODate, n: number): ISODate {
  const [, , day] = parts(d);
  const month = addMonthKey(monthOf(d), n);
  const [y, m] = parts(month);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${pad(Math.min(day, last))}`;
}

export const isValidDate = (d: unknown): d is ISODate =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && fromUTC(toUTC(d)) === d;

const fmt = (d: ISODate, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' }).format(toUTC(d));

export const formatMonth = (m: MonthKey) => fmt(`${m}-01`, { month: 'long', year: 'numeric' });
export const formatMonthShort = (m: MonthKey) => fmt(`${m}-01`, { month: 'short' });
export const formatDay = (d: ISODate) => fmt(d, { month: 'short', day: 'numeric' });
export const formatDayFull = (d: ISODate) =>
  fmt(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
