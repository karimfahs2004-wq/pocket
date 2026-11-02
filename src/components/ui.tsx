import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, TriangleAlert, X } from 'lucide-react';
import { addMonthKey, formatMonth } from '../domain/dates';
import type { Transaction, TxType } from '../domain/types';
import type { BudgetLevel } from '../domain/budget';
import { TransactionForm } from './TransactionForm';

// --- Bottom sheet, built on the native <dialog> for focus handling and the back gesture

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="sheet-body">
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={22} aria-hidden /></button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

// --- App-wide actions: add/edit transaction, confirm and toast

interface ConfirmOptions { title: string; body: string; action: string }
interface ToastOptions { message: string; undo?: () => void }
interface Ui {
  newTransaction: (type?: TxType) => void;
  editTransaction: (tx: Transaction) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (o: ToastOptions) => void;
}

const UiContext = createContext<Ui | null>(null);
export const useUi = () => useContext(UiContext)!;

export function UiProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{ tx?: Transaction; type?: TxType; key: number } | null>(null);
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [note, setNote] = useState<ToastOptions | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((o: ToastOptions) => {
    setNote(o);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), o.undo ? 6000 : 3000);
  }, []);

  const ui = useMemo<Ui>(() => ({
    newTransaction: (type) => setForm({ type, key: Date.now() }),
    editTransaction: (tx) => setForm({ tx, key: Date.now() }),
    confirm: (o) => new Promise((resolve) => setAsk({ ...o, resolve })),
    toast,
  }), [toast]);

  const answer = (v: boolean) => { ask?.resolve(v); setAsk(null); };

  return (
    <UiContext.Provider value={ui}>
      {children}
      {form && (
        <Sheet key={form.key} title={form.tx ? 'Edit transaction' : 'Add transaction'} onClose={() => setForm(null)}>
          <TransactionForm tx={form.tx} initialType={form.type} onDone={() => setForm(null)} />
        </Sheet>
      )}
      {ask && (
        <Sheet title={ask.title} onClose={() => answer(false)}>
          <p className="muted">{ask.body}</p>
          <div className="row-actions">
            <button className="btn" onClick={() => answer(false)}>Cancel</button>
            <button className="btn danger" onClick={() => answer(true)}>{ask.action}</button>
          </div>
        </Sheet>
      )}
      {note && (
        <div className="toast" role="status">
          <span>{note.message}</span>
          {note.undo && (
            <button onClick={() => { note.undo!(); setNote(null); }}>Undo</button>
          )}
        </div>
      )}
    </UiContext.Provider>
  );
}

// --- Small shared pieces

export function PageHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button className="icon-btn" onClick={() => onChange(addMonthKey(month, -1))} aria-label="Previous month"><ChevronLeft size={22} aria-hidden /></button>
      <strong aria-live="polite">{formatMonth(month)}</strong>
      <button className="icon-btn" onClick={() => onChange(addMonthKey(month, 1))} aria-label="Next month"><ChevronRight size={22} aria-hidden /></button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Dot({ slot }: { slot: number }) {
  return <span className="dot" style={{ background: `var(--series-${slot + 1})` }} aria-hidden />;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Warnings always pair colour with an icon and words, so they're clear without colour. */
export function LevelBadge({ level }: { level: BudgetLevel }) {
  if (level === 'ok') return null;
  return level === 'over'
    ? <span className="badge over"><CircleAlert size={14} aria-hidden />Over limit</span>
    : <span className="badge near"><TriangleAlert size={14} aria-hidden />Near limit</span>;
}

export function Meter({ ratio, level }: { ratio: number; level: BudgetLevel }) {
  return (
    <div className={`meter ${level}`} role="img" aria-label={`${Math.round(ratio * 100)}% used`}>
      <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}
