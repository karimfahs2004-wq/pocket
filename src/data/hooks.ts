import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { DEFAULT_SETTINGS } from '../domain/types';
import { formatMoney } from '../domain/money';
import { db } from './db';
import { getSettings } from './repo';

/** All app data, kept live: screens update by themselves whenever the database changes. */
export function useAppData() {
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray());
  const categories = useLiveQuery(async () =>
    (await db.categories.toArray()).sort((a, b) => a.name.localeCompare(b.name)),
  );
  const budgets = useLiveQuery(() => db.budgets.toArray());
  const settings = useLiveQuery(getSettings);

  return useMemo(() => {
    const cur = settings ?? DEFAULT_SETTINGS;
    return {
      ready: !!(transactions && categories && budgets && settings),
      transactions: transactions ?? [],
      categories: categories ?? [],
      categoryById: new Map((categories ?? []).map((c) => [c.id, c])),
      budgets: budgets ?? [],
      settings: cur,
      money: (cents: number) => formatMoney(cents, cur.currency),
    };
  }, [transactions, categories, budgets, settings]);
}
