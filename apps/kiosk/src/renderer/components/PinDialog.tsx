import { useEffect, useRef, useState } from 'react';
import { Delete, X } from 'lucide-react';

interface PinDialogProps {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Wrong attempts before the pad locks, and the first lockout length */
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_SECONDS = 30;
const MAX_LOCKOUT_SECONDS = 300;

/**
 * Module scope, deliberately, NOT component state.
 *
 * This dialog unmounts when it is dismissed, so a counter held in useState was
 * wiped by tapping the X: five wrong guesses, 30s lock, close, hold the logo for
 * 3s, and the pad came back with a clean slate. The penalty never had to be
 * served, which made this a control that reported itself as a defence while
 * costing an attacker about four seconds.
 *
 * A kiosk process runs for weeks, so module scope outlives every realistic
 * attempt. It does not survive a restart - someone with the power lead can still
 * reset it - but that is a different threat from someone standing at the panel.
 */
let failedAttempts = 0;
let lockoutLevel = 0;
let lockedUntilMs = 0;

function registerFailure(): void {
  failedAttempts += 1;
  if (failedAttempts < MAX_ATTEMPTS) return;

  // Each further group of failures costs more, so repeated guessing gets worse
  // rather than settling into a flat 5-per-30s forever.
  failedAttempts = 0;
  lockoutLevel += 1;
  const seconds = Math.min(BASE_LOCKOUT_SECONDS * 2 ** (lockoutLevel - 1), MAX_LOCKOUT_SECONDS);
  lockedUntilMs = Date.now() + seconds * 1000;
}

function clearFailures(): void {
  failedAttempts = 0;
  lockoutLevel = 0;
  lockedUntilMs = 0;
}

/** Shared key styling: the pad must not disappear into the card behind it */
const KEY_CLASS =
  'touchable focus-ring rounded-2xl border-2 border-cream-400 bg-cream-50 py-6 text-ink-900 ' +
  'active:bg-cream-300 disabled:opacity-40';

export function PinDialog({ expectedPin, onSuccess, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  /** Ticks only so the countdown re-renders; the deadline itself is module state */
  const [, setTick] = useState(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  const lockedFor = Math.max(0, Math.ceil((lockedUntilMs - Date.now()) / 1000));

  // Only ticks while something is actually locked. Running it always meant the pad
  // re-rendered twice a second under a staff member's fingers while they typed.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setInterval(() => setTick((value) => value + 1), 500);
    return () => clearInterval(timer);
  }, [lockedFor]);
  const isLocked = lockedFor > 0;

  const press = (key: string) => {
    if (isLocked || !expectedPin) return;
    setError(false);
    const next = (pin + key).slice(0, 8);
    setPin(next);

    if (next.length >= expectedPin.length) {
      if (next === expectedPin) {
        clearFailures();
        onSuccess();
        return;
      }

      registerFailure();
      setError(true);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setPin(''), 600);
    }
  };

  /*
   * An unset PIN would otherwise make every keypress an instant failure, since
   * next.length >= 0 is always true — five taps and the pad locks itself, with no
   * explanation, against staff who never had a PIN to type.
   */
  if (!expectedPin) {
    return (
      <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-10">
        <div className="animate-scale-in card w-full max-w-[560px] p-10 text-center">
          <h2 className="text-3xl font-extrabold text-ink-900">No staff PIN set</h2>
          <p className="mt-4 text-lg text-ink-700">
            This kiosk has no admin PIN configured, so the panel cannot be opened here.
            Set one from the kiosk settings file.
          </p>
          <button type="button" onClick={onCancel} className="btn-primary mt-8 w-full text-kiosk-xs">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    // z-[75]: the one dialog whose entire job is to be a barrier should not sit
    // below the toast and the other dialogs it is meant to gate.
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/80 p-10">
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
