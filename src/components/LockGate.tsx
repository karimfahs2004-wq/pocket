import { useLiveQuery } from 'dexie-react-hooks';
import { LockKeyhole } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { restoreBackup } from '../data/backup';
import { unlock } from '../data/lock';
import { getSettings } from '../data/repo';

/** How long the app can sit in the background before it locks again. */
const RELOCK_AFTER_MS = 60_000;

export function LockGate({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(getSettings);
  const lockId = settings?.lockCredentialId;
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const hiddenAt = useRef<number | null>(null);
  const tried = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        tried.current = false;
        setUnlocked(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const tryUnlock = async () => {
    if (!lockId || busy) return;
    setBusy(true);
    const ok = await unlock(lockId);
    setBusy(false);
    setFailed(!ok);
    if (ok) setUnlocked(true);
  };

  // Opened without a lock: stay open, even if you turn the lock on now. It applies next time.
  const openedUnlocked = settings !== undefined && !lockId;
  useEffect(() => { if (openedUnlocked) setUnlocked(true); }, [openedUnlocked]);

  const locked = !!lockId && !unlocked;
  // Ask for Face ID straight away. Some phones need a tap first, so the button stays too.
  useEffect(() => {
    if (locked && !tried.current) { tried.current = true; void tryUnlock(); }
  });

  if (settings === undefined) return null;
  if (!locked) return <>{children}</>;

  const restore = async (file?: File) => {
    if (!file) return;
    try {
      await restoreBackup(JSON.parse(await file.text()), undefined, false);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file is not a Pocket backup.');
    }
  };

  return (
    <div className="lock">
      <LockKeyhole size={40} aria-hidden />
      <h1>Pocket is locked</h1>
      <button className="btn primary" onClick={tryUnlock} disabled={busy}>{busy ? 'Checking…' : 'Unlock with Face ID'}</button>
      {failed && <p className="muted small">That didn't work. Try again. If Face ID fails, your phone passcode works too.</p>}
      {!help ? (
        <button className="link small" onClick={() => setHelp(true)}>Can't unlock?</button>
      ) : (
        <div className="lock-help">
          <p className="small">If Face ID and your passcode both stop working, restore a backup. It replaces the data on this phone with the backup and turns the lock off.</p>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore a backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => restore(e.target.files?.[0])} />
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
