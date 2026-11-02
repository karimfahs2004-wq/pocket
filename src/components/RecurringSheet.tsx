import { useEffect, useState, type FormEvent } from 'react';
import { useAppData } from '../data/hooks';
import { saveRecurring } from '../data/repo';
import { todayISO } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { Frequency, RecurringRule, TxType } from '../domain/types';
import { AmountField } from './AmountField';
import { CategoryPicker } from './CategoryPicker';
import { Segmented, Sheet, useUi } from './ui';

export function RecurringSheet({ rule, salary, onClose }: {
  rule?: RecurringRule; salary?: boolean; onClose: () => void;
}) {
  const { categories } = useAppData();
  const { toast } = useUi();
  const [type, setType] = useState<TxType>(rule?.type ?? (salary ? 'income' : 'expense'));
  const [name, setName] = useState(rule?.name ?? (salary ? 'Salary' : ''));
  const [amount, setAmount] = useState(rule ? centsToInput(rule.amountCents) : '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? (salary ? 'salary' : ''));
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? 'monthly');
  const [startDate, setStartDate] = useState(rule?.startDate ?? todayISO());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setErrors({}), [amount, name, categoryId, startDate]);

  const options = categories.filter((c) => c.kind === type && (!c.archived || c.id === categoryId));
  const isPast = !rule && startDate < todayISO();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    const next: Record<string, string> = {};
    if (!cents) next.amount = 'Enter an amount above 0, like 30.';
    if (!name.trim()) next.name = 'Enter a name, like Gym membership.';
    if (!categoryId) next.category = 'Choose a category.';
    if (!startDate) next.date = 'Choose a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    await saveRecurring({ type, name: name.trim(), amountCents: cents!, categoryId, frequency, startDate, notes: rule?.notes }, rule?.id);
    toast({ message: rule ? 'Recurring payment saved' : 'Recurring payment added' });
    onClose();
  };

  return (
    <Sheet title={rule ? 'Edit recurring payment' : salary ? 'Add your salary' : 'Add recurring payment'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="form">
        <Segmented label="Type" value={type} onChange={(t) => { setType(t); setCategoryId(''); }} options={[
          { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' },
        ]} />
        <AmountField label="Amount" large autoFocus={!rule} value={amount} onChange={setAmount} error={errors.amount} />
        <div className="field">
          <label htmlFor="r-name">Name</label>
          <input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gym membership" aria-invalid={!!errors.name} />
          {errors.name && <p className="error">{errors.name}</p>}
        </div>
        <CategoryPicker categories={options} value={categoryId} onChange={setCategoryId} />
        {errors.category && <p className="error">{errors.category}</p>}
        <div className="field">
          <span className="label">Repeats</span>
          <Segmented label="Repeats" value={frequency} onChange={setFrequency} options={[
            { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' },
          ]} />
        </div>
        <div className="field">
          <label htmlFor="r-date">{rule ? 'Payment date' : 'First payment date'}</label>
          <input id="r-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-invalid={!!errors.date} />
          {errors.date && <p className="error">{errors.date}</p>}
          {isPast && <p className="hint">Past payments since this date will be added too.</p>}
          {rule && <p className="hint">Changes apply to future payments. Past transactions stay as they are.</p>}
        </div>
        <button className="btn primary wide">{rule ? 'Save changes' : 'Add recurring payment'}</button>
      </form>
    </Sheet>
  );
}
