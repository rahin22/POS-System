import { useEffect, useRef, useState } from 'react';
import { Delete, X } from 'lucide-react';

interface PinDialogProps {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Wrong attempts before the pad locks, and for how long */
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

/** Shared key styling: the pad must not disappear into the card behind it */
const KEY_CLASS =
  'touchable focus-ring rounded-2xl border-2 border-cream-400 bg-cream-50 py-6 text-ink-900 ' +
  'active:bg-cream-300 disabled:opacity-40';

export function PinDialog({ expectedPin, onSuccess, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  /**
   * This pad sits on a machine the public can reach, and behind it is the admin
   * panel that holds the API URL and the EFTPOS settings. Unlimited attempts on a
   * short numeric PIN is not a real lock, so wrong guesses cost time.
   */
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setTimeout(() => setLockedFor((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedFor]);

  const isLocked = lockedFor > 0;

  const press = (key: string) => {
    if (isLocked) return;
    setError(false);
    const next = (pin + key).slice(0, 8);
    setPin(next);

    if (next.length >= expectedPin.length) {
      if (next === expectedPin) {
        onSuccess();
        return;
      }

      const failed = attempts + 1;
      setAttempts(failed);
      setError(true);
      if (failed >= MAX_ATTEMPTS) {
        setAttempts(0);
        setLockedFor(LOCKOUT_SECONDS);
      }
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setPin(''), 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-10">
      <div className="animate-scale-in card w-full max-w-[560px] p-10">
        <div className="flex items-start justify-between">
          <h2 className="text-3xl font-extrabold text-ink-900">Staff access</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="touchable focus-ring flex h-14 w-14 items-center justify-center rounded-full border-2 border-cream-400 bg-cream-50 text-ink-800"
          >
            <X className="h-7 w-7" aria-hidden="true" />
          </button>
        </div>

        <div className="my-8 flex justify-center gap-4" aria-live="polite">
          {Array.from({ length: Math.max(expectedPin.length, 4) }).map((_, index) => (
            <span
              key={index}
              className={`h-6 w-6 rounded-full ${
                error ? 'bg-danger' : index < pin.length ? 'bg-brand-500' : 'bg-cream-400'
              }`}
            />
          ))}
        </div>

        {isLocked ? (
          <p className="mb-6 text-center text-lg font-bold text-danger" aria-live="assertive">
            Too many attempts — try again in {lockedFor}s
          </p>
        ) : (
          error && <p className="mb-6 text-center text-lg text-danger">Incorrect PIN</p>
        )}

        <div className="grid grid-cols-3 gap-4">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={isLocked}
              className={`${KEY_CLASS} text-3xl font-bold`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            disabled={isLocked}
            className={`${KEY_CLASS} text-lg font-semibold`}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => press('0')}
            disabled={isLocked}
            className={`${KEY_CLASS} text-3xl font-bold`}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((prev) => prev.slice(0, -1))}
            disabled={isLocked}
            aria-label="Backspace"
            className={`${KEY_CLASS} flex items-center justify-center`}
          >
            <Delete className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
