import { useId } from 'react';

export function AmountField({ label, value, onChange, error, large, autoFocus, allowNegative }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
  large?: boolean; autoFocus?: boolean; allowNegative?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={large ? 'amount-input' : undefined}
        // iPhone's decimal keypad has no minus key, so negatives need the full keyboard.
        inputMode={allowNegative ? 'text' : 'decimal'}
        autoComplete="off"
        placeholder="0.00"
        value={value}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
    </div>
  );
}
