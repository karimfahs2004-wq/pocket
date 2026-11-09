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
  /** When it was added, so entries on the same day stay in the order you added them. */
  createdAt?: number;
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

export type Asset = 'cash' | 'gold' | 'silver';

/**
 * Money set aside or invested. It isn't spending, so budgets and expense reports ignore it,
 * but it does leave your spending money: "in" lowers what's left, "out" adds it back.
 */
export interface SavingsEntry {
  id: string;
  asset: Asset;
  /** in: put into savings or bought. out: taken out or sold. */
  direction: 'in' | 'out';
  /** Money moved: amount saved, price paid, or amount received. */
  amountCents: number;
  /** Gold coins or silver ounces, in thousandths so 0.5 oz is exact. Cash has none. */
  quantityMilli?: number;
  date: ISODate;
  notes?: string;
  createdAt?: number;
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
  /** The month whose summary was last dismissed. */
  summarySeenFor?: MonthKey;
  /** PIN lock: a salted hash of the PIN, never the PIN. Never included in backups. */
  pinHash?: string;
  pinSalt?: string;
  /** Old recurring payments, kept for reference after that feature was removed. */
  retiredRecurring?: unknown[];
}

export const DEFAULT_SETTINGS: Settings = { currency: 'USD', openingBalanceCents: 0 };
