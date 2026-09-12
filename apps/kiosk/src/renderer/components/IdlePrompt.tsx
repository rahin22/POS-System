import { Clock } from 'lucide-react';

interface IdlePromptProps {
  onContinue: () => void;
  onFinish: () => void;
}

/**
 * Sits above the item sheet (z-50) on purpose — an earlier version rendered
 * behind it, so a customer deliberating over options never saw the warning and
 * had their basket cleared out from under them.
 */
export function IdlePrompt({ onContinue, onFinish }: IdlePromptProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/70 p-12">
      <div className="animate-scale-in card w-full max-w-[820px] p-14 text-center">
        <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-brand-100">
          <Clock className="h-14 w-14 text-brand-600" aria-hidden="true" />
        </span>

        <h2 className="mt-8 text-kiosk-2xl font-extrabold text-ink-900">Still ordering?</h2>
        <p className="mt-4 text-kiosk-lg text-ink-700">
          Take your time &mdash; just let us know you&apos;re still here.
        </p>

        <button type="button" onClick={onContinue} className="btn-primary mt-10 w-full text-kiosk-lg">
          Yes, keep ordering
        </button>

        <button type="button" onClick={onFinish} className="btn-quiet mx-auto mt-6 text-kiosk-xs">
          Start over
        </button>
      </div>
    </div>
  );
}
