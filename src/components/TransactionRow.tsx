import type { Category, Transaction } from '../domain/types';
import { formatDay } from '../domain/dates';
import { Dot, useUi } from './ui';

export function TransactionRow({ tx, category, money, showDate = true }: {
  tx: Transaction; category?: Category; money: (c: number) => string; showDate?: boolean;
}) {
  const { editTransaction } = useUi();
  return (
    <li>
      <button className="tx-row" onClick={() => editTransaction(tx)} aria-label={`Edit ${tx.name}`}>
        <Dot slot={category?.colorSlot ?? 6} />
        <span className="tx-main">
          <span className="tx-name">{tx.name}</span>
          <span className="tx-meta">{category?.name ?? 'Uncategorized'}{showDate && `, ${formatDay(tx.date)}`}</span>
        </span>
        <span className={`tx-amount num ${tx.type}`}>
          {tx.type === 'income' ? '+' : ''}{money(tx.amountCents)}
        </span>
      </button>
    </li>
  );
}
