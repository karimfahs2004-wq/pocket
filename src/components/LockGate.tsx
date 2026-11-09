import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { restoreBackup } from '../data/backup';
import { checkPin, clearOldFaceIdLock } from '../data/pin';
import { getSettings } from '../data/repo';
import { PinPad } from './PinPad';

/** How long the app can sit in the background before it locks again. */
const RELOCK_AFTER_MS = 60_000;
/** After this many wrong PINs in a row, wait before trying again. */
const MAX_TRIES = 5;
const WAIT_SECONDS = 30;

export function LockGate({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(getSettings);
  const hasPin = !!settings?.pinHash;
  const [unlocked, setUnlocked] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const hiddenAt = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void clearOldFaceIdLock(); }, []);

  // Opened without a PIN: stay open, even if you set one now. It applies next time.
  const openedUnlocked = settings !== undefined && !hasPin;
  useEffect(() => { if (openedUnlocked) setUnlocked(true); }, [openedUnlocked]);

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const waiting = waitUntil > now;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  if (settings === undefined) return null;
  if (!hasPin || unlocked) return <>{children}</>;

  const tryPin = async (pin: string) => {
    if (await checkPin(pin)) {
      setWrong(0);
      setUnlocked(true);
      return;
    }
    const n = wrong + 1;
    setWrong(n);
    if (n >= MAX_TRIES) {
      setWrong(0);
      setWaitUntil(Date.now() + WAIT_SECONDS * 1000);
      setNow(Date.now());
    }
  };

  const restore = async (file?: File) => {
    if (!file) return;
    try {
      await restoreBackup(JSON.parse(await file.text()), undefined, false);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file is not a Pocket backup.');
    }
  };

  const message = waiting
    ? `Too many tries. Wait ${Math.ceil((waitUntil - now) / 1000)} seconds.`
    : wrong ? `Wrong PIN. ${MAX_TRIES - wrong} ${MAX_TRIES - wrong === 1 ? 'try' : 'tries'} left before a short wait.` : undefined;

  return (
    <div className="lock">
      <h1>Enter your PIN</h1>
      <PinPad onComplete={tryPin} error={message} disabled={waiting} />
      {!help ? (
        <button className="link small" onClick={() => setHelp(true)}>Forgot your PIN?</button>
      ) : (
        <div className="lock-help">
          <p className="small">Restore a backup to get back in. It replaces the data on this phone with the backup and removes the PIN.</p>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore a backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Backup file" onChange={(e) => restore(e.target.files?.[0])} />
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
