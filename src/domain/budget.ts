export const NEAR_LIMIT = 0.8;
export type BudgetLevel = 'ok' | 'near' | 'over';

export interface BudgetStatus {
  spentCents: number;
  limitCents: number;
  remainingCents: number;
  ratio: number;
  level: BudgetLevel;
}

export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  const ratio = limitCents > 0 ? spentCents / limitCents : 0;
  const level: BudgetLevel = spentCents > limitCents ? 'over' : ratio >= NEAR_LIMIT ? 'near' : 'ok';
  return { spentCents, limitCents, remainingCents: limitCents - spentCents, ratio, level };
}
