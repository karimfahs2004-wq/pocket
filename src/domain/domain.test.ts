import { describe, expect, it } from 'vitest';
import { budgetStatus } from './budget';
import { addMonthsClamped, isValidDate, todayISO } from './dates';
import { formatMoney, parseAmount } from './money';
import { monthsDue, nextPayday, paydayIn } from './salary';
import { averageMonthlySpend, currentBalance, monthTotals, monthlySeries, spendByCategory } from './reports';
import type { Transaction } from './types';

const tx = (o: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), type: 'expense', name: 'x', amountCents: 100,
  categoryId: 'food', date: '2026-11-10', ...o,
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

describe('salary dates', () => {
  const sal = { amountCents: 100000, payDay: 31, lastPaidMonth: '2026-01' };
  it('uses the last day of short months', () => {
    expect(paydayIn('2026-02', 31)).toBe('2026-02-28');
    expect(paydayIn('2028-02', 31)).toBe('2028-02-29');
    expect(paydayIn('2026-04', 31)).toBe('2026-04-30');
    expect(paydayIn('2026-11', 5)).toBe('2026-11-05');
  });
  it('is due only once payday arrives', () => {
    expect(monthsDue(sal, '2026-02-27')).toEqual([]);
    expect(monthsDue(sal, '2026-02-28')).toEqual(['2026-02']);
    expect(monthsDue(sal, '2026-04-30')).toEqual(['2026-02', '2026-03', '2026-04']);
  });
  it('gives the next payday', () => expect(nextPayday(sal, '2026-02-28')).toBe('2026-03-31'));
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
  it('averages only months with expenses, up to the chosen month', () => {
    expect(averageMonthlySpend(txs, '2026-11')).toEqual({ cents: 7000, months: 2 });
    expect(averageMonthlySpend(txs, '2026-10')).toEqual({ cents: 9000, months: 1 });
    expect(averageMonthlySpend(txs, '2026-01')).toEqual({ cents: 0, months: 0 });
  });
});
