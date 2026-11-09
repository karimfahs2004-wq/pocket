import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAppData } from '../data/hooks';
import { addCategory, deleteTransaction, restoreTransaction, saveTransaction } from '../data/repo';
import { formatDay, todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { Transaction, TxType } from '../domain/types';
import { AmountField } from './AmountField';
import { CategoryPicker } from './CategoryPicker';
import { useUi } from './ui';

export function TransactionForm({ tx, initialType, onDone }: {
  tx?: Transaction; initialType?: TxType; onDone: () => void;
}) {
  const { categories, transactions } = useAppData();
  const { toast } = useUi();
  const type: TxType = tx?.type ?? initialType ?? 'expense';
  const today = todayISO();
  const isExpense = type === 'expense';
  const [amount, setAmount] = useState(tx ? centsToInput(tx.amountCents) : '');
  const [name, setName] = useState(tx?.name ?? '');
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? (isExpense ? '' : 'other-income'));
  const [date, setDate] = useState(tx?.date ?? today);
  const [notes, setNotes] = useState(tx?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!tx?.notes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => setErrors({}), [amount, name, categoryId, date]);

  const expenses = useMemo(() => transactions.filter((t) => t.type === 'expense'), [transactions]);

  // Your most-used categories come first, so the one you want is usually in view.
  const options = useMemo(() => {
    const uses = new Map<string, number>();
    for (const t of expenses) uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1);
    return categories
      .filter((c) => c.kind === 'expense' && (!c.archived || c.id === categoryId))
      .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [categories, expenses, categoryId]);

  // Your last few expense names, newest first. Expenses are already sorted newest first.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return expenses.filter((t) => !seen.has(t.name) && seen.size < 4 && seen.add(t.name));
  }, [expenses]);

  const usable = (id: string) => categories.some((c) => c.id === id && !c.archived);

  /** Typing a name you've used before fills in its category. */
  const typeName = (n: string) => {
    setName(n);
    const known = expenses.find((t) => t.name.toLowerCase() === n.trim().toLowerCase());
    if (known && !categoryId && usable(known.categoryId)) setCategoryId(known.categoryId);
  };

  /** Tapping a recent expense repeats it: name, category, and last amount if you haven't typed one. */
  const repeat = (t: Transaction) => {
    setName(t.name);
    if (!categoryId && usable(t.categoryId)) setCategoryId(t.categoryId);
    if (!amount) setAmount(centsToInput(t.amountCents));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = isExpense ? 'Enter a name, like Groceries.' : 'Enter a name, like Freelance job.';
    if (!cents) next.amount = 'Enter an amount above 0, like 12.50.';
    if (!date) next.date = 'Choose a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    // Category is optional: a skipped one is saved as Other (recreated if it was removed).
    const finalCategory = categoryId || (await addCategory('Other'));
    const id = await saveTransaction({
      ...tx, type, name: name.trim(), amountCents: cents!, categoryId: finalCategory, date,
      notes: notes.trim() || undefined,
    });
    const when = date === today || tx ? '' : ` for ${formatDay(date)}`;
    toast(tx
      ? { message: 'Changes saved', undo: () => void restoreTransaction(tx) }
      : { message: `${isExpense ? 'Expense' : 'Income'} added${when}`, undo: () => void deleteTransaction(id) });
    onDone();
  };

  const remove = async () => {
    await deleteTransaction(tx!.id);
    toast({ message: `${isExpense ? 'Expense' : 'Income'} deleted`, undo: () => void restoreTransaction(tx!) });
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="form">
      <div className="field">
        <label htmlFor="tx-name">{isExpense ? 'Expense name' : 'Name'}</label>
        <input id="tx-name" value={name} onChange={(e) => typeName(e.target.value)} placeholder={isExpense ? 'Groceries' : 'Freelance job'} autoFocus={!tx} data-autofocus={!tx || undefined} aria-invalid={!!errors.name} autoCapitalize="sentences" enterKeyHint="done" />
        {errors.name && <p className="error">{errors.name}</p>}
        {isExpense && !tx && !name && recent.length > 0 && (
          <div className="suggest" role="group" aria-label="Repeat a recent expense">
            {recent.map((t) => (
              <button type="button" key={t.id} onClick={() => repeat(t)} aria-label={`Repeat ${t.name}, ${centsToInput(t.amountCents)}`}>
                {t.name} <span className="muted">{centsToInput(t.amountCents)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <AmountField label="Amount" large value={amount} onChange={setAmount} error={errors.amount} />
      {isExpense && <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} optional />}
      <div className="field">
        <label htmlFor="tx-date">Date</label>
        <input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
        {errors.date && <p className="error">{errors.date}</p>}
      </div>
      {showNotes ? (
        <div className="field">
          <label htmlFor="tx-notes">Notes (optional)</label>
          <textarea id="tx-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      ) : (
        <button type="button" className="link left" onClick={() => setShowNotes(true)}>Add a note</button>
      )}
      <div className="sheet-actions">
        <button className="btn primary wide">{tx ? 'Save changes' : isExpense ? 'Add expense' : 'Add income'}</button>
        {tx && <button type="button" className="btn ghost-danger wide" onClick={remove}>Delete {isExpense ? 'expense' : 'income'}</button>}
      </div>
    </form>
  );
}
