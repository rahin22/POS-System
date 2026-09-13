import { Check, Trash2 } from 'lucide-react';

interface ToastProps {
  message: string;
  /** When present the toast stays longer and offers a way back */
  onUndo?: () => void;
}

/** Confirms an action without stealing the customer's place in the menu */
export function Toast({ message, onUndo }: ToastProps) {
  return (
    /*
     * z-[55]: above the sheets (z-40 CategorySheet, z-50 ItemSheet/ComboSheet) and
     * below the interrupts (z-60 idle prompt, z-70 confirm). It previously sat at
     * z-40, level with CategorySheet, and only rendered on top because App happens
     * to mount it later in the DOM — and it was genuinely hidden behind anything at
     * z-50. A confirmation the customer cannot see is the same as no confirmation.
     */
    <div
      className={`fixed inset-x-0 z-[55] flex justify-center px-10 ${
        // Sits clear of the cart's total + Pay button when it carries an action
        onUndo ? 'bottom-[300px]' : 'bottom-[190px] pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="animate-toast-in flex items-center gap-4 rounded-full bg-ink-900 px-10 py-6 shadow-lifted">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            onUndo ? 'bg-ink-700' : 'bg-success'
          }`}
        >
          {onUndo ? (
            <Trash2 className="h-6 w-6 text-white" aria-hidden="true" />
          ) : (
            <Check className="h-7 w-7 text-white" strokeWidth={3} aria-hidden="true" />
          )}
        </span>
        <span className="text-kiosk-xs font-bold text-white">{message}</span>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="touchable ml-4 rounded-full bg-brand-500 px-8 py-4 text-kiosk-xs font-extrabold text-ink-900"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
