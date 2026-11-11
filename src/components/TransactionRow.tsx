import { Pencil } from 'lucide-react';
import type { Category, Transaction } from '../domain/types';
import { formatDay } from '../domain/dates';
import { CatIcon } from './CatIcon';
import { useUi } from './ui';

export function TransactionRow({ tx, category, money, showDate = true }: {
  tx: Transaction; category?: Category; money: (c: number) => string; showDate?: boolean;
}) {
  const { editTransaction } = useUi();
  return (
    <li className="tx-item">
      {/* Tapping the row or the pencil both open the edit screen. */}
      <button className="tx-row" onClick={() => editTransaction(tx)} tabIndex={-1} aria-hidden>
        <CatIcon category={category} />
        <span className="tx-main">
          <span className="tx-name">{tx.name}</span>
          <span className="tx-meta">{category?.name ?? 'Uncategorized'}{showDate && `, ${formatDay(tx.date)}`}</span>
        </span>
        <span className={`tx-amount num ${tx.type}`}>
          {tx.type === 'income' ? '+' : ''}{money(tx.amountCents)}
        </span>
      </button>
      <button className="icon-btn tx-edit" onClick={() => editTransaction(tx)} aria-label={`Edit ${tx.name}, ${money(tx.amountCents)}`}>
        <Pencil size={18} aria-hidden />
      </button>
    </li>
  );
}
