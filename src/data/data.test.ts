import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, restoreBackup, validateBackup } from './backup';
import { db } from './db';
import {
  addCategory, deleteTransaction, getSettings, removeCategory, saveRecurring,
  saveTransaction, setRecurringPaused, syncRecurring, updateSettings,
} from './repo';

const gym = {
  type: 'expense' as const, name: 'Gym', amountCents: 3000, categoryId: 'gym',
  frequency: 'monthly' as const, startDate: '2026-09-15',
};
const dates = async () => (await db.transactions.orderBy('date').toArray()).map((t) => t.date);

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('categories', () => {
  it('seeds the requested defaults', async () => {
    const names = (await db.categories.toArray()).map((c) => c.name);
    for (const n of ['Gym', 'Phone', 'Food', 'Transportation', 'Entertainment', 'Shopping', 'Other', 'Salary'])
      expect(names).toContain(n);
  });
  it('deletes unused, archives used, blocks when a recurring payment needs it', async () => {
    const id = await addCategory('Pets', 'expense', 1);
    expect(await removeCategory(id)).toBe('deleted');
    await saveTransaction({ type: 'expense', name: 'x', amountCents: 1, categoryId: 'food', date: '2026-01-01' });
    expect(await removeCategory('food')).toBe('archived');
    expect((await db.categories.get('food'))?.archived).toBe(true);
    await saveRecurring(gym, undefined, '2026-09-01');
    expect(await removeCategory('gym')).toBe('blocked');
  });
});

describe('recurring generation', () => {
  it('backfills from the start date and only once', async () => {
    await saveRecurring(gym, undefined, '2026-11-02');
    expect(await dates()).toEqual(['2026-09-15', '2026-10-15']);
    await syncRecurring('2026-11-02');
    await syncRecurring('2026-11-02');
    expect((await dates()).length).toBe(2);
    expect((await db.recurring.toArray())[0].nextDue).toBe('2026-11-15');
  });
  it('generates on the due date', async () => {
    await saveRecurring(gym, undefined, '2026-11-02');
    await syncRecurring('2026-11-15');
    expect(await dates()).toContain('2026-11-15');
  });
  it('does not bring back a deleted payment', async () => {
    await saveRecurring(gym, undefined, '2026-10-20');
    const [t] = await db.transactions.orderBy('date').toArray();
    await deleteTransaction(t.id);
    await syncRecurring('2026-10-25');
    expect(await dates()).toEqual(['2026-10-15']);
  });
  it('skips the paused period', async () => {
    await saveRecurring(gym, undefined, '2026-09-20');
    const [r] = await db.recurring.toArray();
    await setRecurringPaused(r.id, true);
    await syncRecurring('2026-12-20');
    expect((await dates()).length).toBe(1);
    await setRecurringPaused(r.id, false, '2026-12-20');
    expect(await dates()).toEqual(['2026-09-15']);
    await syncRecurring('2027-01-15');
    expect(await dates()).toEqual(['2026-09-15', '2027-01-15']);
  });
  it('applies an amount edit to future payments only', async () => {
    await saveRecurring(gym, undefined, '2026-09-20');
    const [r] = await db.recurring.toArray();
    await saveRecurring({ ...gym, amountCents: 4000 }, r.id, '2026-09-21');
    await syncRecurring('2026-10-15');
    const amounts = (await db.transactions.orderBy('date').toArray()).map((t) => t.amountCents);
    expect(amounts).toEqual([3000, 4000]);
  });
  it('does not duplicate when a schedule edit lands on an existing date', async () => {
    await saveRecurring({ ...gym, startDate: '2026-10-01' }, undefined, '2026-10-01');
    const [r] = await db.recurring.toArray();
    await saveRecurring({ ...gym, startDate: '2026-10-01', frequency: 'weekly' }, r.id, '2026-10-01');
    expect(await dates()).toEqual(['2026-10-01']);
  });
});

describe('backup', () => {
  it('round-trips everything', async () => {
    await saveTransaction({ type: 'income', name: 'Pay', amountCents: 100000, categoryId: 'salary', date: '2026-11-01' });
    await updateSettings({ openingBalanceCents: 5000, currency: 'EUR' });
    await db.budgets.put({ id: 'overall', amountCents: 50000 });
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    await db.transactions.clear();
    await updateSettings({ currency: 'USD' });
    expect(await restoreBackup(backup)).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    expect((await getSettings()).currency).toBe('EUR');
    expect((await db.budgets.toArray())[0].amountCents).toBe(50000);
  });
  it('rejects bad files without touching data', async () => {
    await saveTransaction({ type: 'income', name: 'Pay', amountCents: 1, categoryId: 'salary', date: '2026-11-01' });
    expect(() => validateBackup({ hello: 1 })).toThrow('not a Pocket backup');
    const good = await buildBackup();
    const bad = JSON.parse(JSON.stringify(good));
    bad.data.transactions[0].amountCents = 'lots';
    await expect(restoreBackup(bad)).rejects.toThrow('damaged');
    expect(await db.transactions.count()).toBe(1);
  });
});
