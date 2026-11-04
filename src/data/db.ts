import Dexie, { type EntityTable } from 'dexie';
import { todayISO } from '../domain/dates';
import { migrateLegacy, type LegacyRule, type LegacyTransaction } from '../domain/legacy';
import type { Budget, Category, Transaction } from '../domain/types';

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
  budgets: EntityTable<Budget, 'id'>;
  settings: EntityTable<SettingRow, 'key'>;
};

db.version(1).stores({
  transactions: 'id, date, categoryId, [recurringId+occurrenceDate]',
  categories: 'id',
  recurring: 'id',
  budgets: 'id',
  settings: 'key',
});

// Version 2 removes recurring payments. Every transaction is kept, and a monthly
// salary rule becomes the new salary setting. Add db.version(3) for future changes.
db.version(2)
  .stores({ transactions: 'id, date, categoryId', recurring: null })
  .upgrade(async (tx) => {
    const rules: LegacyRule[] = await tx.table('recurring').toArray();
    const txs: LegacyTransaction[] = await tx.table('transactions').toArray();
    const { added, salary, retired } = migrateLegacy(rules, txs, todayISO(), newId);
    await tx.table('transactions').bulkAdd(added);
    await tx.table('transactions').toCollection().modify((t: LegacyTransaction) => {
      delete t.recurringId;
      delete t.occurrenceDate;
    });
    if (salary) await tx.table('settings').put({ key: 'salary', value: salary });
    if (retired.length) await tx.table('settings').put({ key: 'retiredRecurring', value: retired });
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
