import { Repeat } from 'lucide-react';
import type { Category, Transaction } from '../domain/types';
import { formatDay } from '../domain/dates';
import { Dot, useUi } from './ui';

export function TransactionRow({ tx, category, money }: {
  tx: Transaction; category?: Category; money: (c: number) => string;
}) {
  const { editTransaction } = useUi();
  return (
    <li>
      <button className="tx-row" onClick={() => editTransaction(tx)} aria-label={`Edit ${tx.name}`}>
        <Dot slot={category?.colorSlot ?? 6} />
        <span className="tx-main">
          <span className="tx-name">{tx.name}{tx.recurringId && <Repeat size={13} aria-label="Recurring" className="tx-rep" />}</span>
          <span className="tx-meta">{category?.name ?? 'Uncategorized'}, {formatDay(tx.date)}</span>
        </span>
        <span className={`tx-amount num ${tx.type}`}>
          {tx.type === 'income' ? '+' : '-'}{money(tx.amountCents)}
        </span>
      </button>
    </li>
  );
}
