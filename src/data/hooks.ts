import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { DEFAULT_SETTINGS } from '../domain/types';
import { formatMoney } from '../domain/money';
import { db } from './db';
import { getSettings } from './repo';

/** All app data, kept live: screens update by themselves whenever the database changes. */
export function useAppData() {
  // Newest first. Entries on the same day show the one you added last at the top.
  const newest = <T extends { date: string; createdAt?: number }>(a: T, b: T) =>
    b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0);
  const transactions = useLiveQuery(async () => (await db.transactions.toArray()).sort(newest));
  const categories = useLiveQuery(async () =>
    (await db.categories.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
  );
  const budgets = useLiveQuery(() => db.budgets.toArray());
  const savings = useLiveQuery(async () => (await db.savings.toArray()).sort(newest));
  const settings = useLiveQuery(getSettings);

  return useMemo(() => {
    const cur = settings ?? DEFAULT_SETTINGS;
    return {
      ready: !!(transactions && categories && budgets && savings && settings),
      transactions: transactions ?? [],
      categories: categories ?? [],
      categoryById: new Map((categories ?? []).map((c) => [c.id, c])),
      budgets: budgets ?? [],
      savings: savings ?? [],
      settings: cur,
      money: (cents: number) => formatMoney(cents, cur.currency),
    };
  }, [transactions, categories, budgets, savings, settings]);
}
