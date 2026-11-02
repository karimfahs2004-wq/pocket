import Dexie, { type EntityTable } from 'dexie';
import type { Budget, Category, RecurringRule, Transaction } from '../domain/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

export const DEFAULT_CATEGORIES: Category[] = [
  ['food', 'Food', 0],
  ['transportation', 'Transportation', 1],
  ['gym', 'Gym', 2],
  ['phone', 'Phone', 3],
  ['entertainment', 'Entertainment', 4],
  ['shopping', 'Shopping', 5],
  ['other', 'Other', 6],
].map(([id, name, colorSlot]) => ({ id, name, colorSlot, kind: 'expense' }) as Category)
  .concat(
    [
      ['salary', 'Salary', 2],
      ['side-income', 'Side income', 0],
      ['other-income', 'Other income', 6],
    ].map(([id, name, colorSlot]) => ({ id, name, colorSlot, kind: 'income' }) as Category),
  );

export const db = new Dexie('pocket') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  categories: EntityTable<Category, 'id'>;
  recurring: EntityTable<RecurringRule, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

// To change the schema later, add db.version(2).stores({...}) below this one.
db.version(1).stores({
  transactions: 'id, date, categoryId, [recurringId+occurrenceDate]',
  categories: 'id',
  recurring: 'id',
  budgets: 'id',
  settings: 'key',
});

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(DEFAULT_CATEGORIES);
});

export function newId(): string {
  // crypto.randomUUID needs HTTPS; this also works when testing over a local network.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
