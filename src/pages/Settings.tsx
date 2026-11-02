import { ArrowLeft, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AmountField } from '../components/AmountField';
import { Dot, Segmented, Sheet, useUi } from '../components/ui';
import { buildBackup, restoreBackup } from '../data/backup';
import { useAppData } from '../data/hooks';
import { addCategory, removeCategory, updateCategory, updateSettings } from '../data/repo';
import { centsToInput, parseAmount } from '../domain/money';
import { todayISO } from '../domain/dates';
import type { Category, TxType } from '../domain/types';

const CURRENCIES = ['USD', 'LBP', 'EUR', 'GBP', 'AED', 'SAR'];

function CategorySheet({ category, kind, onClose }: { category?: Category; kind: TxType; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [slot, setSlot] = useState(category?.colorSlot ?? 0);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter a category name.');
    if (category) await updateCategory(category.id, { name: name.trim(), colorSlot: slot });
    else await addCategory(name, kind, slot);
    onClose();
  };
  return (
    <Sheet title={category ? 'Edit category' : 'Add category'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!category} />
          {error && <p className="error">{error}</p>}
        </div>
        <div className="field">
          <span className="label">Color</span>
          <div className="swatches">
            {Array.from({ length: 8 }, (_, i) => (
              <button type="button" key={i} aria-label={`Color ${i + 1}`} aria-pressed={slot === i} onClick={() => setSlot(i)} style={{ background: `var(--series-${i + 1})` }} />
            ))}
          </div>
        </div>
        <button className="btn primary wide">Save category</button>
      </form>
    </Sheet>
  );
}

export default function Settings() {
  const d = useAppData();
  const { confirm, toast } = useUi();
  const [kind, setKind] = useState<TxType>('expense');
  const [sheet, setSheet] = useState<{ category?: Category } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openingError, setOpeningError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!d.ready) return null;

  const openingValue = opening ?? centsToInput(d.settings.openingBalanceCents);

  const saveOpening = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(openingValue || '0', true);
    if (cents === null) return setOpeningError('Enter an amount, like 500 or -50.');
    setOpeningError('');
    await updateSettings({ openingBalanceCents: cents });
    setOpening(null);
    toast({ message: 'Starting balance saved' });
  };

  const download = async () => {
    const backup = await buildBackup();
    const name = `pocket-backup-${todayISO()}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    // Home-screen apps on phones handle the share menu better than downloads.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
      } catch {
        return; // Cancelled, so don't record a backup.
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
    await updateSettings({ lastBackupAt: backup.exportedAt });
    toast({ message: 'Backup saved' });
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
      body: 'Everything currently in Pocket will be replaced by the backup.',
      action: 'Replace my data',
    });
    if (!yes) return;
    try {
      const count = await restoreBackup(raw);
      toast({ message: `Backup restored, ${count} transactions` });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'The backup could not be restored.' });
    }
  };

  const remove = async (c: Category) => {
    const yes = await confirm({
      title: `Delete ${c.name}?`,
      body: 'If past transactions use it, they keep it, but you can no longer choose it for new ones.',
      action: 'Delete',
    });
    if (!yes) return;
    const result = await removeCategory(c.id);
    toast({
      message: result === 'blocked'
        ? `A recurring payment uses ${c.name}. Change that payment first.`
        : `${c.name} deleted`,
    });
  };

  const list = d.categories.filter((c) => c.kind === kind && !c.archived);
  const backupDate = d.settings.lastBackupAt && new Date(d.settings.lastBackupAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="stack">
      <header className="page-head">
        <div className="line">
          <Link to="/" className="icon-btn" aria-label="Back to Home"><ArrowLeft size={22} aria-hidden /></Link>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="panel form">
        <h2>Money</h2>
        <form onSubmit={saveOpening} className="form" noValidate>
          <AmountField label="Starting balance" allowNegative value={openingValue} onChange={setOpening} error={openingError} />
          <p className="hint">What you had before you started using Pocket. Your overall balance builds on this.</p>
          {opening !== null && <button className="btn primary">Save starting balance</button>}
        </form>
        <div className="field">
          <label htmlFor="s-cur">Currency</label>
          <select id="s-cur" value={d.settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p className="hint">This changes the symbol only. Amounts are not converted.</p>
        </div>
      </section>

      <section className="panel form">
        <div className="panel-head">
          <h2>Categories</h2>
          <button className="btn small" onClick={() => setSheet({})}><Plus size={15} aria-hidden />Add</button>
        </div>
        <Segmented label="Category type" value={kind} onChange={setKind} options={[
          { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' },
        ]} />
        <ul className="plain-list">
          {list.map((c) => (
            <li key={c.id} className="line">
              <Dot slot={c.colorSlot} />
              <span className="grow">{c.name}</span>
              <button className="icon-btn" aria-label={`Edit ${c.name}`} onClick={() => setSheet({ category: c })}><Pencil size={18} aria-hidden /></button>
              <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><Trash2 size={18} aria-hidden /></button>
            </li>
          ))}
        </ul>
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

      {sheet && <CategorySheet category={sheet.category} kind={kind} onClose={() => setSheet(null)} />}
    </div>
  );
}
