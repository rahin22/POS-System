import { LifeBuoy } from 'lucide-react';

/**
 * ordering    - cart intact, kiosk working. Staff can finish the order for them.
 * charged     - the card was taken and the order failed. This screen is evidence.
 * unavailable - nothing charged, but the kiosk cannot reach the backend, so staff
 *               cannot finish it here either and there is no order to go back to.
 *
 * Splitting on charged-ness alone was not enough: 'unavailable' is uncharged AND
 * unrecoverable, so the reassuring copy ("your order is safe", "back to my order")
 * was false on the one screen that already says to go to the counter.
 */
export type HelpContext = 'ordering' | 'charged' | 'unavailable';

interface HelpDialogProps {
  onClose: () => void;
  context?: HelpContext;
}

const COPY: Record<HelpContext, { body: string; close: string }> = {
  ordering: {
    body: 'Please ask a staff member at the counter — they can take your order or finish it for you. Your order is safe on this screen.',
    close: 'Back to my order',
  },
  charged: {
    body: 'Please show this screen to a staff member at the counter — they can sort it out for you.',
    close: 'Close',
  },
  unavailable: {
    body: 'This kiosk can’t reach the kitchen right now, so please order at the counter. Nothing has been charged.',
    close: 'Close',
  },
};

export function HelpDialog({ onClose, context = 'ordering' }: HelpDialogProps) {
  const copy = COPY[context];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-12">
      <div className="animate-scale-in card w-full max-w-[820px] p-14 text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-100">
          <LifeBuoy className="h-12 w-12 text-brand-700" aria-hidden="true" />
        </span>

        <h2 className="mt-8 text-kiosk-xl font-extrabold text-ink-900">Need a hand?</h2>
        <p className="mt-4 text-kiosk-base text-ink-700">{copy.body}</p>

        <button type="button" onClick={onClose} className="btn-primary mt-10 w-full text-kiosk-base">
          {copy.close}
        </button>
      </div>
    </div>
  );
}
