import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup, validateBackup } from './backup';
import { db } from './db';
import { checkPin, clearOldFaceIdLock, removePin, setPin } from './pin';
import {
  addCategory, deleteTransaction, getSettings, removeCategory, removeSalary, saveSalary,
  saveTransaction, syncSalary, updateSettings,
} from './repo';

const income = async () =>
  (await db.transactions.orderBy('date').toArray()).filter((t) => t.type === 'income');

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('categories', () => {
  it('seeds the defaults', async () => {
    const names = (await db.categories.toArray()).map((c) => c.name);
    for (const n of ['Gym', 'Phone', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Other', 'Salary'])
      expect(names).toContain(n);
  });
  it('adds from the form without duplicates', async () => {
    const id = await addCategory(' Pets ');
    expect((await db.categories.get(id))?.name).toBe('Pets');
    expect(await addCategory('pets')).toBe(id);
  });
  it('deletes unused and archives used', async () => {
    const id = await addCategory('Pets');
    expect(await removeCategory(id)).toBe('deleted');
    await saveTransaction({ type: 'expense', name: 'x', amountCents: 1, categoryId: 'food', date: '2026-01-01' });
    expect(await removeCategory('food')).toBe('archived');
    expect((await db.categories.get('food'))?.archived).toBe(true);
    expect(await addCategory('Food')).toBe('food');
    expect((await db.categories.get('food'))?.archived).toBe(false);
  });
});

describe('salary', () => {
  it('counts only once payday arrives', async () => {
    await saveSalary(100000, 25, '2026-11-04');
    expect(await income()).toEqual([]);
    await syncSalary('2026-11-24');
    expect(await income()).toEqual([]);
    await syncSalary('2026-11-25');
    expect((await income()).map((t) => [t.date, t.amountCents])).toEqual([['2026-11-25', 100000]]);
  });
  it('adds this month when payday has passed, and only once', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    await syncSalary('2026-11-04');
    await syncSalary('2026-11-04');
    expect((await income()).map((t) => t.date)).toEqual(['2026-11-01']);
  });
  it('catches up after time away', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    await syncSalary('2027-02-15');
    expect((await income()).map((t) => t.date)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
  });
  it('changing it keeps past months accurate', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    await saveSalary(150000, 1, '2026-11-20');
    await syncSalary('2026-12-01');
    expect((await income()).map((t) => t.amountCents)).toEqual([100000, 150000]);
  });
  it('does not bring back a deleted payment', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    const [t] = await income();
    await deleteTransaction(t.id);
    await syncSalary('2026-11-30');
    expect(await income()).toEqual([]);
  });
  it('does not double a salary entered by hand', async () => {
    await saveTransaction({ type: 'income', name: 'Pay', amountCents: 90000, categoryId: 'salary', date: '2026-11-02' });
    await saveSalary(100000, 3, '2026-11-04');
    expect((await income()).map((t) => t.amountCents)).toEqual([90000]);
  });
  it('removing it stops future pay and keeps the past', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    await removeSalary();
    await syncSalary('2027-03-01');
    expect((await income()).length).toBe(1);
  });
});

describe('upgrade from the first version', () => {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthsAgo = (n: number, day: number) => iso(new Date(today.getFullYear(), today.getMonth() - n, day));

  async function seedV1(rules: object[], txs: object[], settings: object[] = []) {
    db.close();
    await Dexie.delete('pocket');
    const old = new Dexie('pocket');
    old.version(1).stores({
      transactions: 'id, date, categoryId, [recurringId+occurrenceDate]',
      categories: 'id', recurring: 'id', budgets: 'id', settings: 'key',
    });
    await old.open();
    await old.table('categories').bulkAdd([{ id: 'food', name: 'Food', kind: 'expense', colorSlot: 0 }, { id: 'salary', name: 'Salary', kind: 'income', colorSlot: 2 }]);
    await old.table('recurring').bulkAdd(rules);
    await old.table('transactions').bulkAdd(txs);
    await old.table('budgets').add({ id: 'overall', amountCents: 50000 });
    await old.table('settings').bulkAdd([{ key: 'openingBalanceCents', value: 7700 }, ...settings]);
    old.close();
    await db.open();
  }
  const rule = (o: object) => ({ id: 'r', type: 'expense', name: 'Gym', amountCents: 3000, categoryId: 'gym', frequency: 'monthly', paused: false, ...o });
  const tx = (o: object) => ({ type: 'expense', name: 'Lunch', amountCents: 500, categoryId: 'food', ...o });

  it('keeps every record and converts the salary', async () => {
    await seedV1(
      [rule({ id: 'sal', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', startDate: monthsAgo(2, 1), nextDue: monthsAgo(-1, 1) })],
      [
        tx({ id: 'a', date: monthsAgo(1, 3) }),
        tx({ id: 's1', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', date: monthsAgo(2, 1), recurringId: 'sal', occurrenceDate: monthsAgo(2, 1) }),
        tx({ id: 's2', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', date: monthsAgo(1, 1), recurringId: 'sal', occurrenceDate: monthsAgo(1, 1) }),
        tx({ id: 's3', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', date: monthsAgo(0, 1), recurringId: 'sal', occurrenceDate: monthsAgo(0, 1) }),
      ],
    );
    expect(await db.transactions.count()).toBe(4);
    const s = await getSettings();
    expect(s.openingBalanceCents).toBe(7700);
    expect(s.salary).toEqual({ amountCents: 120000, payDay: 1, lastPaidMonth: monthsAgo(0, 1).slice(0, 7) });
    expect(s.retiredRecurring?.length).toBe(1);
    expect(await db.budgets.count()).toBe(1);
    expect(db.tables.map((t) => t.name)).not.toContain('recurring');
    expect((await db.transactions.get('s1')) as object).not.toHaveProperty('recurringId');
    await syncSalary();
    expect(await db.transactions.count()).toBe(4);
  });

  it('records payments that fell due just before the upgrade', async () => {
    await seedV1([rule({ startDate: monthsAgo(2, 1), nextDue: monthsAgo(1, 1) })], []);
    const dates = (await db.transactions.orderBy('date').toArray()).map((t) => t.date);
    expect(dates).toEqual([monthsAgo(1, 1), monthsAgo(0, 1)]);
    expect((await getSettings()).salary).toBeUndefined();
  });

  it('skips paused rules', async () => {
    await seedV1([rule({ paused: true, startDate: monthsAgo(2, 1), nextDue: monthsAgo(1, 1) })], []);
    expect(await db.transactions.count()).toBe(0);
  });
});

describe('backup', () => {
  it('round-trips everything', async () => {
    await saveSalary(100000, 1, '2026-11-04');
    await updateSettings({ openingBalanceCents: 5000, currency: 'EUR' });
    await db.budgets.put({ id: 'overall', amountCents: 50000 });
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    await db.transactions.clear();
    await updateSettings({ currency: 'USD' });
    await removeSalary();
    expect(await restoreBackup(backup, '2026-11-04')).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    const s = await getSettings();
    expect(s.currency).toBe('EUR');
    expect(s.salary?.amountCents).toBe(100000);
    expect((await db.budgets.toArray())[0].amountCents).toBe(50000);
  });
  it('restores a backup from the first version', async () => {
    const v1 = {
      app: 'pocket', version: 1, exportedAt: '2026-11-02T00:00:00Z',
      data: {
        transactions: [{ id: 'p', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', date: '2026-11-01', recurringId: 'sal', occurrenceDate: '2026-11-01' }],
        categories: [{ id: 'salary', name: 'Salary', kind: 'income', colorSlot: 2 }],
        recurring: [{ id: 'sal', type: 'income', name: 'Salary', amountCents: 120000, categoryId: 'salary', frequency: 'monthly', startDate: '2026-11-01', nextDue: '2026-12-01', paused: false }],
        budgets: [],
        settings: { currency: 'USD', openingBalanceCents: 100 },
      },
    };
    expect(await restoreBackup(v1, '2026-11-04')).toBe(1);
    expect((await getSettings()).salary).toEqual({ amountCents: 120000, payDay: 1, lastPaidMonth: '2026-11' });
    expect((await db.transactions.get('p')) as object).not.toHaveProperty('recurringId');
    await syncSalary('2026-12-01');
    expect(await db.transactions.count()).toBe(2);
  });
  it('rejects bad files without touching data', async () => {
    await saveTransaction({ type: 'income', name: 'Pay', amountCents: 1, categoryId: 'salary', date: '2026-11-01' });
    expect(() => validateBackup({ hello: 1 })).toThrow('not a Pocket backup');
    const bad = JSON.parse(JSON.stringify(await buildBackup()));
    bad.data.transactions[0].amountCents = 'lots';
    await expect(restoreBackup(bad)).rejects.toThrow('damaged');
    expect(await db.transactions.count()).toBe(1);
  });
});

describe('savings storage', () => {
  it('backs up savings, and never the PIN', async () => {
    await db.savings.add({ id: 's1', asset: 'gold', direction: 'in', amountCents: 50000, quantityMilli: 1000, date: '2026-11-01' });
    await setPin('1234');
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    expect(backup.version).toBe(3);
    expect(backup.data.savings).toHaveLength(1);
    expect(backup.data.settings.pinHash).toBeUndefined();
    expect(JSON.stringify(backup)).not.toContain('1234');
    await db.savings.clear();
    await restoreBackup(backup, '2026-11-04');
    expect(await db.savings.count()).toBe(1);
    expect(await checkPin('1234')).toBe(true);
    await restoreBackup(backup, '2026-11-04', false);
    expect((await getSettings()).pinHash).toBeUndefined();
  });
  it('restores older backups without savings', async () => {
    const v2 = { app: 'pocket', version: 2, exportedAt: 'x', data: { transactions: [], categories: [], budgets: [], settings: { currency: 'USD', openingBalanceCents: 0 } } };
    await restoreBackup(v2, '2026-11-04');
    expect(await db.savings.count()).toBe(0);
  });
});

describe('PIN', () => {
  it('stores only a hash and checks it', async () => {
    await setPin('4821');
    const s = await getSettings();
    expect(s.pinHash).toBeTruthy();
    expect(JSON.stringify(s)).not.toContain('4821');
    expect(await checkPin('4821')).toBe(true);
    expect(await checkPin('4820')).toBe(false);
    await removePin();
    expect(await checkPin('4821')).toBe(false);
  });
  it('clears the old Face ID lock', async () => {
    await db.settings.put({ key: 'lockCredentialId', value: 'old' });
    await clearOldFaceIdLock();
    expect(await db.settings.get('lockCredentialId')).toBeUndefined();
  });
});
