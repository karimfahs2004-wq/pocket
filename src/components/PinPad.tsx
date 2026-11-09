import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PIN_LENGTH } from '../data/pin';

/**
 * Four dots and a number pad, so no keyboard has to open. It submits by itself after
 * the fourth digit. On a computer, typing digits works too.
 */
export function PinPad({ onComplete, error, disabled }: {
  onComplete: (pin: string) => Promise<boolean | void> | void;
  error?: string;
  disabled?: boolean;
}) {
  const [pin, setPin] = useState('');

  const press = (k: string) => {
    if (disabled) return;
    if (k === 'back') return setPin((p) => p.slice(0, -1));
    setPin((p) => (p.length < PIN_LENGTH ? p + k : p));
  };

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    void Promise.resolve(onComplete(pin)).then(() => setPin(''));
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pinpad">
      <div className={`pin-dots${error ? ' wrong' : ''}`} role="img" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <p className="pin-error" role="alert">{error ?? ''}</p>
      <div className="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k, i) =>
          k === '' ? <span key={i} /> : (
            <button type="button" key={i} disabled={disabled} onClick={() => press(k)}
              aria-label={k === 'back' ? 'Delete digit' : k} className={k === 'back' ? 'key-back' : undefined}>
              {k === 'back' ? <Delete size={24} aria-hidden /> : k}
            </button>
          ))}
      </div>
    </div>
  );
}
