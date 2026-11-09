import { isValidDate, todayISO } from '../domain/dates';
import { migrateLegacy, stripLegacy, type LegacyRule, type LegacyTransaction } from '../domain/legacy';
import { getSettings, syncSalary, updateSettings } from './repo';
import { db, newId } from './db';

const APP = 'pocket';
const VERSION = 3;

export async function buildBackup() {
  const exportedAt = new Date().toISOString();
  const [transactions, categories, budgets, savings, allSettings] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.savings.toArray(),
    getSettings(),
  ]);
  // The Face ID passkey belongs to this phone, so it never goes into a backup.
  const { lockCredentialId: _lock, ...settings } = allSettings;
  return {
    app: APP,
    version: VERSION,
    exportedAt,
    data: { transactions, categories, budgets, savings, settings },
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
  const { transactions, categories, recurring = [], budgets, settings, savings = [] } = raw.data;
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
    Array.isArray(savings) &&
    savings.every(
      (e) => isText(e?.id) && ['cash', 'gold', 'silver'].includes(e.asset) && ['in', 'out'].includes(e.direction) &&
        isCents(e.amountCents) && (e.quantityMilli === undefined || isCents(e.quantityMilli)) && isValidDate(e.date),
    ) &&
    Array.isArray(budgets) &&
    budgets.every((b) => isText(b?.id) && isCents(b.amountCents)) &&
    isObj(settings) &&
    isText(settings.currency) &&
    isCents(settings.openingBalanceCents);
  if (!ok) throw new Error('This backup is damaged, so nothing was changed.');
  return { ...raw.data, recurring, savings } as Awaited<ReturnType<typeof buildBackup>>['data'] & {
    recurring: LegacyRule[];
  };
}

/**
 * Replaces everything in the app with the backup, all or nothing. Old backups are upgraded.
 * The Face ID lock stays as it is unless `keepLock` is false.
 */
export async function restoreBackup(raw: unknown, today = todayISO(), keepLock = true) {
  const data = validateBackup(raw);
  const old = migrateLegacy(data.recurring, data.transactions as LegacyTransaction[], today, newId);
  const transactions = [...data.transactions.map(stripLegacy), ...old.added];
  const lock = keepLock ? (await getSettings()).lockCredentialId : undefined;
  const { lockCredentialId: _ignored, ...backupSettings } = data.settings as typeof data.settings & { lockCredentialId?: string };
  const settings = {
    ...backupSettings,
    ...(lock ? { lockCredentialId: lock } : {}),
    ...(old.salary ? { salary: old.salary } : {}),
    ...(old.retired.length ? { retiredRecurring: old.retired } : {}),
  };
  await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.savings, db.settings], async () => {
    await Promise.all([
      db.transactions.clear(), db.categories.clear(), db.budgets.clear(), db.savings.clear(), db.settings.clear(),
    ]);
    await db.savings.bulkAdd(data.savings);
    await db.transactions.bulkAdd(transactions);
    await db.categories.bulkAdd(data.categories);
    await db.budgets.bulkAdd(data.budgets);
    await updateSettings(settings);
  });
  await syncSalary(today);
  return transactions.length;
}
