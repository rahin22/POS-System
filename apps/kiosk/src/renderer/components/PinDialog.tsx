import { useState } from 'react';
import { Delete, X } from 'lucide-react';

interface PinDialogProps {
  expectedPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinDialog({ expectedPin, onSuccess, onCancel }: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const press = (key: string) => {
    setError(false);
    const next = (pin + key).slice(0, 8);
    setPin(next);

    if (next.length >= expectedPin.length) {
      if (next === expectedPin) {
        onSuccess();
      } else {
        setError(true);
        setTimeout(() => setPin(''), 600);
      }
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
            className="touchable flex h-14 w-14 items-center justify-center rounded-full bg-white text-ink-800"
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

        {error && <p className="mb-6 text-center text-lg text-danger">Incorrect PIN</p>}

        <div className="grid grid-cols-3 gap-4">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="touchable rounded-2xl bg-white py-6 text-3xl font-bold text-ink-900 hover:bg-cream-200"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="touchable rounded-2xl bg-white py-6 text-lg font-semibold text-ink-700 hover:bg-cream-200"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => press('0')}
            className="touchable rounded-2xl bg-white py-6 text-3xl font-bold text-ink-900 hover:bg-cream-200"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((prev) => prev.slice(0, -1))}
            aria-label="Backspace"
            className="touchable flex items-center justify-center rounded-2xl bg-white py-6 text-ink-700 hover:bg-cream-200"
          >
            <Delete className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
