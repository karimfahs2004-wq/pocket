import { useEffect, useState, type FormEvent } from 'react';
import { useAppData } from '../data/hooks';
import { deleteTransaction, restoreTransaction, saveTransaction } from '../data/repo';
import { todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { Transaction, TxType } from '../domain/types';
import { AmountField } from './AmountField';
import { CategoryPicker } from './CategoryPicker';
import { Segmented, useUi } from './ui';

export function TransactionForm({ tx, initialType, onDone }: {
  tx?: Transaction; initialType?: TxType; onDone: () => void;
}) {
  const { categories } = useAppData();
  const { toast } = useUi();
  const [type, setType] = useState<TxType>(tx?.type ?? initialType ?? 'expense');
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amountCents) : '');
  const [name, setName] = useState(tx?.name ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '');
  const [date, setDate] = useState(tx?.date ?? todayISO());
  const [notes, setNotes] = useState(tx?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setErrors({}), [amount, name, categoryId, date]);

  const options = categories.filter((c) => c.kind === type && (!c.archived || c.id === categoryId));

  const changeType = (t: TxType) => { setType(t); setCategoryId(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    const next: Record<string, string> = {};
    if (!cents) next.amount = 'Enter an amount above 0, like 12.50.';
    if (!name.trim()) next.name = 'Enter a name, like Groceries.';
    if (!categoryId) next.category = 'Choose a category.';
    if (!date) next.date = 'Choose a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    await saveTransaction({
      ...tx, type, name: name.trim(), amountCents: cents!, categoryId, date,
      notes: notes.trim() || undefined,
    });
    toast({ message: tx ? 'Transaction saved' : `${type === 'income' ? 'Income' : 'Expense'} added` });
    onDone();
  };

  const remove = async () => {
    await deleteTransaction(tx!.id);
    toast({ message: 'Transaction deleted', undo: () => void restoreTransaction(tx!) });
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="form">
      <Segmented label="Type" value={type} onChange={changeType} options={[
        { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' },
      ]} />
      <AmountField label="Amount" large autoFocus={!tx} value={amount} onChange={setAmount} error={errors.amount} />
      <div className="field">
        <label htmlFor="tx-name">Name</label>
        <input id="tx-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'income' ? 'November salary' : 'Groceries'} aria-invalid={!!errors.name} autoCapitalize="sentences" />
        {errors.name && <p className="error">{errors.name}</p>}
      </div>
      <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} />
      {errors.category && <p className="error">{errors.category}</p>}
      <div className="field">
        <label htmlFor="tx-date">Date</label>
        <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
        {errors.date && <p className="error">{errors.date}</p>}
      </div>
      <div className="field">
        <label htmlFor="tx-notes">Notes (optional)</label>
        <textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <button className="btn primary wide">{tx ? 'Save changes' : type === 'income' ? 'Add income' : 'Add expense'}</button>
      {tx && <button type="button" className="btn ghost-danger wide" onClick={remove}>Delete transaction</button>}
    </form>
  );
}
