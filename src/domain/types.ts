export type ISODate = string; // 'YYYY-MM-DD', always a local calendar date
export type MonthKey = string; // 'YYYY-MM'
export type TxType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TxType;
  name: string;
  /** Stored in whole cents so totals never pick up floating-point errors. */
  amountCents: number;
  categoryId: string;
  date: ISODate;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TxType;
  /** Index into the chart palette (0-7), so colours adapt to dark mode. */
  colorSlot: number;
  archived?: boolean;
}

/** Salary that's added as income on payday each month. */
export interface Salary {
  amountCents: number;
  /** Day of the month, 1-31. Short months use their last day. */
  payDay: number;
  /** The latest month that has been handled, so a deleted payment doesn't come back. */
  lastPaidMonth: MonthKey;
}

export const OVERALL_BUDGET_ID = 'overall';

export interface Budget {
  /** 'overall', or the category id the limit applies to. */
  id: string;
  amountCents: number;
}

export interface Settings {
  currency: string;
  openingBalanceCents: number;
  lastBackupAt?: string;
  salary?: Salary;
  /** Old recurring payments, kept for reference after that feature was removed. */
  retiredRecurring?: unknown[];
}

export const DEFAULT_SETTINGS: Settings = { currency: 'USD', openingBalanceCents: 0 };
