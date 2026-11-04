import { addMonthKey, monthOf, todayISO } from '../domain/dates';
import { monthsDue, paydayIn } from '../domain/salary';
import {
  DEFAULT_SETTINGS,
  type Budget,
  type Category,
  type Settings,
  type Transaction,
} from '../domain/types';
import { db, newId } from './db';

// --- Transactions

export async function saveTransaction(tx: Omit<Transaction, 'id'> & { id?: string }) {
  await db.transactions.put({ ...tx, id: tx.id ?? newId() });
}
export const deleteTransaction = (id: string) => db.transactions.delete(id);
export const restoreTransaction = (tx: Transaction) => db.transactions.put(tx);

// --- Salary

/**
 * Adds salary as income once its payday arrives, so expected pay never counts as money
 * received. Safe to run as often as you like, and it catches up after time away.
 */
export async function syncSalary(today = todayISO()): Promise<number> {
  let created = 0;
  await db.transaction('rw', db.settings, db.transactions, async () => {
    const salary = (await db.settings.get('salary'))?.value as Settings['salary'];
    if (!salary) return;
    const due = monthsDue(salary, today);
    if (!due.length) return;
    for (const month of due) {
      // A salary you entered yourself for this month counts, so it isn't added twice.
      const exists = await db.transactions
        .where('date').between(`${month}-01`, `${month}-31`, true, true)
        .filter((t) => t.type === 'income' && t.categoryId === 'salary')
        .count();
      if (exists) continue;
      await db.transactions.add({
        id: newId(), type: 'income', name: 'Salary', amountCents: salary.amountCents,
        categoryId: 'salary', date: paydayIn(month, salary.payDay),
      });
      created++;
    }
    await db.settings.put({ key: 'salary', value: { ...salary, lastPaidMonth: due[due.length - 1] } });
  });
  return created;
}

/** A change applies from the next payday. Salary already received stays as it was. */
export async function saveSalary(amountCents: number, payDay: number, today = todayISO()) {
  const current = (await getSettings()).salary;
  const lastPaidMonth = current?.lastPaidMonth ?? addMonthKey(monthOf(today), -1);
  await db.settings.put({ key: 'salary', value: { amountCents, payDay, lastPaidMonth } });
  await syncSalary(today);
}

/** Stops future salary. Past salary stays in your history. */
export const removeSalary = () => db.settings.delete('salary');

// --- Budgets

export const setBudget = (b: Budget) => db.budgets.put(b);
export const removeBudget = (id: string) => db.budgets.delete(id);

// --- Categories

/** Reuses a category with the same name, so a quick add can't create duplicates. */
export async function addCategory(name: string, colorSlot?: number): Promise<string> {
  const clean = name.trim();
  return db.transaction('rw', db.categories, async () => {
    const all = (await db.categories.toArray()).filter((c) => c.kind === 'expense');
    const same = all.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (same) {
      if (same.archived) await db.categories.update(same.id, { archived: false });
      return same.id;
    }
    const active = all.filter((c) => !c.archived);
    const used = (slot: number) => active.filter((c) => c.colorSlot === slot).length;
    const slot = colorSlot ?? [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => used(a) - used(b))[0];
    const id = newId();
    await db.categories.add({ id, name: clean, kind: 'expense', colorSlot: slot });
    return id;
  });
}

export const updateCategory = (id: string, changes: Partial<Pick<Category, 'name' | 'colorSlot'>>) =>
  db.categories.update(id, changes);

export type RemoveResult = 'deleted' | 'archived';

/** A category used by past expenses is archived so your history stays correct. */
export async function removeCategory(id: string): Promise<RemoveResult> {
  return db.transaction('rw', db.categories, db.transactions, db.budgets, async () => {
    await db.budgets.delete(id);
    if ((await db.transactions.where('categoryId').equals(id).count()) > 0) {
      await db.categories.update(id, { archived: true });
      return 'archived';
    }
    await db.categories.delete(id);
    return 'deleted';
  });
}

// --- Settings

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
}

export async function updateSettings(changes: Partial<Settings>) {
  await db.settings.bulkPut(Object.entries(changes).map(([key, value]) => ({ key, value })));
}
