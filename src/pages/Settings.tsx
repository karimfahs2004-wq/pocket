import { ChevronRight, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { checkPin, removePin, setPin } from '../data/pin';
import { PinPad } from '../components/PinPad';
import { Link } from 'react-router-dom';
import { CatIcon } from '../components/CatIcon';
import { BackButton, Sheet, useUi } from '../components/ui';
import { buildBackup, restoreBackup } from '../data/backup';
import { saveBackupFile } from '../data/saveBackup';
import { useAppData } from '../data/hooks';
import { addCategory, removeCategory, restoreCategory, updateCategory, updateSettings } from '../data/repo';
import type { Category } from '../domain/types';
import { COLOR_SLOTS, freeSlot } from '../domain/colors';

const CURRENCIES = ['USD', 'LBP', 'EUR', 'GBP', 'AED', 'SAR'];

function CategorySheet({ category, suggested, onClose }: { category?: Category; suggested: number; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [slot, setSlot] = useState(category?.colorSlot ?? suggested);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a category name.');
    if (category) await updateCategory(category.id, { name: name.trim(), colorSlot: slot });
    else await addCategory(name, slot);
    onClose();
  };
  return (
    <Sheet title={category ? 'Edit category' : 'Add category'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!category} data-autofocus={!category || undefined} />
          {error && <p className="error">{error}</p>}
        </div>
        <div className="field">
          <span className="label">Color</span>
          <div className="swatches">
            {Array.from({ length: COLOR_SLOTS }, (_, i) => (
              <button type="button" key={i} aria-label={`Color ${i + 1}`} aria-pressed={slot === i} onClick={() => setSlot(i)} style={{ background: `var(--series-${i + 1})` }} />
            ))}
          </div>
        </div>
        <button className="btn primary wide">Save category</button>
      </form>
    </Sheet>
  );
}

/** Set, change or turn off the PIN. Changing or turning off asks for the current PIN first. */
function PinSheet({ mode, onClose }: { mode: 'set' | 'change' | 'off'; onClose: () => void }) {
  const { toast } = useUi();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(mode === 'set' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string>();

  const title = { current: 'Enter your current PIN', new: mode === 'set' ? 'Choose a 4-digit PIN' : 'Choose a new PIN', confirm: 'Enter it again' }[step];

  const done = async (pin: string) => {
    setError(undefined);
    if (step === 'current') {
      if (!(await checkPin(pin))) return setError('Wrong PIN.');
      if (mode === 'off') {
        await removePin();
        toast({ message: 'PIN turned off' });
        return onClose();
      }
      return setStep('new');
    }
    if (step === 'new') { setFirst(pin); return setStep('confirm'); }
    if (pin !== first) { setStep('new'); return setError("The PINs didn't match. Choose one again."); }
    await setPin(pin);
    toast({ message: mode === 'set' ? 'PIN set. Pocket will ask for it next time.' : 'PIN changed' });
    onClose();
  };

  return (
    <Sheet title={mode === 'off' ? 'Turn off PIN' : mode === 'change' ? 'Change PIN' : 'Set a PIN'} onClose={onClose}>
      <p className="pin-step">{title}</p>
      <PinPad key={step} onComplete={done} error={error} />
    </Sheet>
  );
}

export default function Settings() {
  const d = useAppData();
  const { confirm, toast } = useUi();
  const [sheet, setSheet] = useState<{ category?: Category } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pinFlow, setPinFlow] = useState<'set' | 'change' | 'off' | null>(null);
  if (!d.ready) return null;

  const pinOn = !!d.settings.pinHash;

  const download = async () => {
    if (await saveBackupFile()) toast({ message: 'Backup saved' });
  };

  const restore = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return toast({ message: 'This file is not a Pocket backup.' });
    }
    const yes = await confirm({
      title: 'Restore this backup?',
      body: 'Everything currently in Pocket will be replaced by the backup. You can undo this right after.',
      action: 'Replace my data',
    });
    if (!yes) return;
    try {
      // Keep what you had, so a wrong file can be undone.
      const before = await buildBackup();
      const count = await restoreBackup(raw);
      toast({ message: `Backup restored, ${count} transactions`, undo: () => void restoreBackup(before) });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'The backup could not be restored.' });
    }
  };

  const remove = async (c: Category) => {
    const yes = await confirm({
      title: `Delete ${c.name}?`,
      body: 'Past expenses keep this category, but you can no longer choose it for new ones.',
      action: 'Delete',
    });
    if (!yes) return;
    const budget = d.budgets.find((b) => b.id === c.id);
    await removeCategory(c.id);
    toast({ message: `${c.name} deleted`, undo: () => void restoreCategory(c, budget) });
  };

  const list = d.categories.filter((c) => c.kind === 'expense' && !c.archived);
  const backupDate = d.settings.lastBackupAt && new Date(d.settings.lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line">
          <BackButton />
          <h1>Settings</h1>
        </div>
      </header>

      <Link to="/money" className="panel link-row">
        <span className="grow"><strong>My money</strong><br />
          <span className="muted small">Savings, gold and silver, income, starting money</span>
        </span>
        <ChevronRight size={20} aria-hidden />
      </Link>

      <section className="panel form">
        <h2>Currency</h2>
        <div className="field">
          <label htmlFor="s-cur">Currency symbol</label>
          <select id="s-cur" value={d.settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p className="hint">This changes the symbol only. Amounts are not converted.</p>
        </div>
      </section>

      <section className="panel form">
        <div className="panel-head">
          <h2>Expense categories</h2>
          <button className="btn small" onClick={() => setSheet({})}><Plus size={15} aria-hidden />Add</button>
        </div>
        <ul className="plain-list">
          {list.map((c) => (
            <li key={c.id} className="line">
              <CatIcon small category={c} />
              <span className="grow">{c.name}</span>
              <button className="icon-btn" aria-label={`Edit ${c.name}`} onClick={() => setSheet({ category: c })}><Pencil size={18} aria-hidden /></button>
              <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><Trash2 size={18} aria-hidden /></button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel form">
        <h2>PIN lock</h2>
        <p className="muted">{pinOn
          ? 'Pocket asks for your 4-digit PIN every time you open it or come back to it.'
          : 'Ask for a 4-digit PIN when opening Pocket.'}</p>
        {!pinOn && !d.settings.lastBackupAt && <p className="hint">Save a backup first. If you forget your PIN, a backup is the only way back in.</p>}
        <div className="row-actions start">
          {pinOn ? (
            <>
              <button className="btn" onClick={() => setPinFlow('change')}>Change PIN</button>
              <button className="btn ghost-danger" onClick={() => setPinFlow('off')}>Turn off PIN</button>
            </>
          ) : (
            <button className="btn primary" onClick={() => setPinFlow('set')}>Set a PIN</button>
          )}
        </div>
      </section>

      <section className="panel form">
        <h2>Backup</h2>
        <p className="muted">Your data is stored only on this device. Save a backup regularly and keep the file somewhere safe, like Google Drive or iCloud.</p>
        <p className="muted small">{backupDate ? `Last backup: ${backupDate}` : 'No backup saved yet'}</p>
        <div className="row-actions start">
          <button className="btn primary" onClick={download}><Download size={18} aria-hidden />Save backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={18} aria-hidden />Restore backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => restore(e.target.files?.[0])} />
        </div>
      </section>

      {pinFlow && <PinSheet mode={pinFlow} onClose={() => setPinFlow(null)} />}
      {sheet && <CategorySheet category={sheet.category} suggested={freeSlot(list.map((c) => c.colorSlot))} onClose={() => setSheet(null)} />}
    </div>
  );
}
