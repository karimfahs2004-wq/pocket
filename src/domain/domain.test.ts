import { describe, expect, it } from 'vitest';
import { budgetStatus } from './budget';
import { addMonthsClamped, isValidDate, todayISO } from './dates';
import { formatMoney, parseAmount } from './money';
import { firstOnOrAfter, occurrencesThrough, upcomingPayments } from './recurring';
import { compareMonths, currentBalance, monthTotals, monthlySeries, spendByCategory } from './reports';
import type { RecurringRule, Transaction } from './types';

const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), type: 'expense', name: 'x', amountCents: 100,
  categoryId: 'food', date: '2026-11-10', ...o,
});
const rule = (o: Partial<RecurringRule>): RecurringRule => ({
  id: 'r', type: 'expense', name: 'Gym', amountCents: 3000, categoryId: 'gym',
  frequency: 'monthly', startDate: '2026-01-31', nextDue: '2026-01-31', paused: false, ...o,
});

describe('parseAmount', () => {
  it.each([
    ['12', 1200], ['12.5', 1250], ['12.50', 1250], ['12,5', 1250], ['1,250.75', 125075],
    ['.5', 50], ['0.07', 7], ['19.99', 1999], [' 8 ', 800], ['1,000', 100000],
  ])('reads %s', (input, cents) => expect(parseAmount(input)).toBe(cents));
  it.each(['', 'abc', '1.234', '1,2,3', '-5', '1e5', '.'])('rejects %s', (input) =>
    expect(parseAmount(input)).toBeNull());
  it('allows negatives only when asked', () => expect(parseAmount('-5.5', true)).toBe(-550));
  it('avoids float errors', () => expect(parseAmount('1.15')).toBe(115));
});

describe('formatMoney', () => {
  it('formats', () => expect(formatMoney(125050, 'USD')).toBe('$1,250.50'));
  it('formats negatives', () => expect(formatMoney(-500, 'USD')).toBe('-$5.00'));
});

describe('dates', () => {
  it('clamps to month end', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('uses the local date', () => expect(todayISO(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02'));
  it('validates', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
  });
});

describe('recurring schedule', () => {
  it('keeps day 31 after a short month', () => {
    expect(occurrencesThrough(rule({}), '2026-04-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });
  it('handles weekly and yearly', () => {
    expect(occurrencesThrough(rule({ frequency: 'weekly', startDate: '2026-11-02', nextDue: '2026-11-02' }), '2026-11-16'))
      .toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(firstOnOrAfter('2024-02-29', 'yearly', '2025-01-01')).toBe('2025-02-28');
  });
  it('lists upcoming only, skipping paused and income rules', () => {
    const rules = [
      rule({ startDate: '2026-11-20', nextDue: '2026-11-20' }),
      rule({ id: 'p', paused: true, startDate: '2026-11-05', nextDue: '2026-11-05' }),
      rule({ id: 'i', type: 'income', startDate: '2026-11-25', nextDue: '2026-11-25' }),
    ];
    const up = upcomingPayments(rules, '2026-11-02', '2026-12-02');
    expect(up.map((u) => [u.rule.id, u.date])).toEqual([['r', '2026-11-20']]);
  });
});

describe('budgetStatus', () => {
  it.each([[0, 'ok'], [7999, 'ok'], [8000, 'near'], [10000, 'near'], [10001, 'over']])(
    'spent %i of 100.00 is %s', (spent, level) => expect(budgetStatus(spent, 10000).level).toBe(level));
  it('reports what is left', () => expect(budgetStatus(12000, 10000).remainingCents).toBe(-2000));
});

describe('reports', () => {
  const txs = [
    tx({ type: 'income', amountCents: 100000, categoryId: 'salary', date: '2026-11-01' }),
    tx({ amountCents: 3000, date: '2026-11-02' }),
    tx({ amountCents: 2000, categoryId: 'gym', date: '2026-11-30' }),
    tx({ amountCents: 9000, date: '2026-10-31' }),
  ];
  it('totals a month', () =>
    expect(monthTotals(txs, '2026-11')).toEqual({ month: '2026-11', incomeCents: 100000, expenseCents: 5000 }));
  it('builds a series oldest first across years', () =>
    expect(monthlySeries(txs, '2027-01', 3).map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01']));
  it('sums by category', () => expect(spendByCategory(txs, '2026-11').get('food')).toBe(3000));
  it('leaves future entries out of the balance', () =>
    expect(currentBalance(txs, 5000, '2026-11-02')).toBe(5000 + 100000 - 3000 - 9000));
  it('compares months', () => {
    const rows = compareMonths(txs, '2026-11', '2026-10');
    expect(rows[0]).toEqual({ categoryId: 'food', aCents: 3000, bCents: 9000, diffCents: -6000 });
    expect(rows[1].categoryId).toBe('gym');
  });
});
