import { addDays, todayISO } from '../domain/dates';
import { firstOnOrAfter, occurrencesThrough } from '../domain/recurring';
import {
  DEFAULT_SETTINGS,
  type Budget,
  type Category,
  type RecurringRule,
  type Settings,
  type Transaction,
  type TxType,
} from '../domain/types';
import { db, newId } from './db';

// --- Transactions

export async function saveTransaction(tx: Omit<Transaction, 'id'> & { id?: string }) {
  await db.transactions.put({ ...tx, id: tx.id ?? newId() });
}
export const deleteTransaction = (id: string) => db.transactions.delete(id);
export const restoreTransaction = (tx: Transaction) => db.transactions.put(tx);

// --- Recurring

/** Creates any transactions that have fallen due. Safe to run as often as you like. */
export async function syncRecurring(today = todayISO()): Promise<number> {
  let created = 0;
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    for (const rule of await db.recurring.toArray()) {
      if (rule.paused || rule.nextDue > today) continue;
      for (const date of occurrencesThrough(rule, today)) {
        // The check stops a duplicate if two tabs sync at once or a schedule is edited.
        const exists = await db.transactions
          .where('[recurringId+occurrenceDate]')
          .equals([rule.id, date])
          .count();
        if (exists) continue;
        await db.transactions.add({
          id: newId(),
          type: rule.type,
          name: rule.name,
          amountCents: rule.amountCents,
          categoryId: rule.categoryId,
          date,
          notes: rule.notes,
          recurringId: rule.id,
          occurrenceDate: date,
        });
        created++;
      }
      const next = firstOnOrAfter(rule.startDate, rule.frequency, addDays(today, 1));
      await db.recurring.update(rule.id, { nextDue: next });
    }
  });
  return created;
}

export type RecurringInput = Omit<RecurringRule, 'id' | 'nextDue' | 'paused'>;

/** New rules catch up from their start date. Edits only change what happens from now on. */
export async function saveRecurring(input: RecurringInput, id?: string, today = todayISO()) {
  const existing = id ? await db.recurring.get(id) : undefined;
  if (existing) {
    const scheduleChanged =
      existing.startDate !== input.startDate || existing.frequency !== input.frequency;
    await db.recurring.put({
      ...existing,
      ...input,
      nextDue: scheduleChanged
        ? firstOnOrAfter(input.startDate, input.frequency, today)
        : existing.nextDue,
    });
  } else {
    await db.recurring.add({ ...input, id: newId(), nextDue: input.startDate, paused: false });
  }
  await syncRecurring(today);
}

/** Resuming skips anything missed while paused, so old bills don't appear all at once. */
export async function setRecurringPaused(id: string, paused: boolean, today = todayISO()) {
  const rule = await db.recurring.get(id);
  if (!rule) return;
  await db.recurring.update(id, {
    paused,
    ...(paused ? {} : { nextDue: firstOnOrAfter(rule.startDate, rule.frequency, today) }),
  });
  if (!paused) await syncRecurring(today);
}

/** Past transactions stay in your history; only future ones stop. */
export const deleteRecurring = (id: string) => db.recurring.delete(id);

// --- Budgets

export const setBudget = (b: Budget) => db.budgets.put(b);
export const removeBudget = (id: string) => db.budgets.delete(id);

// --- Categories

export async function addCategory(name: string, kind: TxType, colorSlot: number) {
  const id = newId();
  await db.categories.add({ id, name: name.trim(), kind, colorSlot });
  return id;
}

export const updateCategory = (id: string, changes: Partial<Pick<Category, 'name' | 'colorSlot'>>) =>
  db.categories.update(id, changes);

export type RemoveResult = 'deleted' | 'archived' | 'blocked';

/**
 * A category used by past transactions is archived so your history stays correct.
 * A category used by a recurring payment must be changed there first.
 */
export async function removeCategory(id: string): Promise<RemoveResult> {
  return db.transaction('rw', db.categories, db.transactions, db.recurring, db.budgets, async () => {
    if ((await db.recurring.filter((r) => r.categoryId === id).count()) > 0) return 'blocked';
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
