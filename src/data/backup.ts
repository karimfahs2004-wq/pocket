import { isValidDate } from '../domain/dates';
import { getSettings, syncRecurring, updateSettings } from './repo';
import { db } from './db';

const APP = 'pocket';
const VERSION = 1;

export async function buildBackup() {
  const exportedAt = new Date().toISOString();
  const [transactions, categories, recurring, budgets, settings] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.recurring.toArray(),
    db.budgets.toArray(),
    getSettings(),
  ]);
  return {
    app: APP,
    version: VERSION,
    exportedAt,
    data: { transactions, categories, recurring, budgets, settings },
  };
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null;
const isCents = (v: unknown) => Number.isSafeInteger(v);
const isType = (v: unknown) => v === 'income' || v === 'expense';
const isText = (v: unknown) => typeof v === 'string' && v.length > 0;

/** Checks the whole file first, so a bad file can never wipe your data. Throws a readable error. */
export function validateBackup(raw: unknown) {
  if (!isObj(raw) || raw.app !== APP || !isObj(raw.data)) {
    throw new Error('This file is not a Pocket backup.');
  }
  if (raw.version > VERSION) throw new Error('This backup is from a newer version of Pocket.');
  const { transactions, categories, recurring, budgets, settings } = raw.data;
  const ok =
    Array.isArray(transactions) &&
    transactions.every(
      (t) => isText(t?.id) && isType(t.type) && isText(t.name) && isCents(t.amountCents) &&
        isText(t.categoryId) && isValidDate(t.date),
    ) &&
    Array.isArray(categories) &&
    categories.every((c) => isText(c?.id) && isText(c.name) && isType(c.kind)) &&
    Array.isArray(recurring) &&
    recurring.every(
      (r) => isText(r?.id) && isType(r.type) && isText(r.name) && isCents(r.amountCents) &&
        ['weekly', 'monthly', 'yearly'].includes(r.frequency) &&
        isValidDate(r.startDate) && isValidDate(r.nextDue),
    ) &&
    Array.isArray(budgets) &&
    budgets.every((b) => isText(b?.id) && isCents(b.amountCents)) &&
    isObj(settings) &&
    isText(settings.currency) &&
    isCents(settings.openingBalanceCents);
  if (!ok) throw new Error('This backup is damaged, so nothing was changed.');
  return raw.data as Awaited<ReturnType<typeof buildBackup>>['data'];
}

/** Replaces everything in the app with the backup, all or nothing. */
export async function restoreBackup(raw: unknown) {
  const data = validateBackup(raw);
  await db.transaction('rw', [db.transactions, db.categories, db.recurring, db.budgets, db.settings], async () => {
    await Promise.all([
      db.transactions.clear(), db.categories.clear(), db.recurring.clear(),
      db.budgets.clear(), db.settings.clear(),
    ]);
    await db.transactions.bulkAdd(data.transactions);
    await db.categories.bulkAdd(data.categories);
    await db.recurring.bulkAdd(data.recurring);
    await db.budgets.bulkAdd(data.budgets);
    await updateSettings(data.settings);
  });
  await syncRecurring();
  return data.transactions.length;
}
