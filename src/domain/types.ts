export type ISODate = string; // 'YYYY-MM-DD', always a local calendar date
export type MonthKey = string; // 'YYYY-MM'
export type TxType = 'income' | 'expense';
export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface Transaction {
  id: string;
  type: TxType;
  name: string;
  /** Stored in whole cents so totals never pick up floating-point errors. */
  amountCents: number;
  categoryId: string;
  date: ISODate;
  notes?: string;
  recurringId?: string;
  occurrenceDate?: ISODate;
}

export interface Category {
  id: string;
  name: string;
  kind: TxType;
  /** Index into the chart palette (0-7), so colours adapt to dark mode. */
  colorSlot: number;
  archived?: boolean;
}

export interface RecurringRule {
  id: string;
  type: TxType;
  name: string;
  amountCents: number;
  categoryId: string;
  frequency: Frequency;
  startDate: ISODate;
  /** The next date a transaction should be generated for. */
  nextDue: ISODate;
  paused: boolean;
  notes?: string;
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
}

export const DEFAULT_SETTINGS: Settings = { currency: 'USD', openingBalanceCents: 0 };
