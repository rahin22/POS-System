import { LifeBuoy } from 'lucide-react';

interface HelpDialogProps {
  onClose: () => void;
  /**
   * The same dialog is reachable from the menu and from a failed or half-finished
   * payment. "Your order is safe on this screen" and "Back to my order" are both
   * false in the payment cases - including the one where the card was charged and
   * no order exists, which is exactly where a false reassurance does most harm.
   */
  context?: 'ordering' | 'payment';
}

export function HelpDialog({ onClose, context = 'ordering' }: HelpDialogProps) {
  const isPayment = context === 'payment';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-12">
      <div className="animate-scale-in card w-full max-w-[820px] p-14 text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-100">
          <LifeBuoy className="h-12 w-12 text-brand-700" aria-hidden="true" />
        </span>

        <h2 className="mt-8 text-kiosk-xl font-extrabold text-ink-900">Need a hand?</h2>
        <p className="mt-4 text-kiosk-base text-ink-700">
          {isPayment
            ? 'Please show this screen to a staff member at the counter — they can sort it out for you.'
            : 'Please ask a staff member at the counter — they can take your order or finish it for you. Your order is safe on this screen.'}
        </p>

        <button type="button" onClick={onClose} className="btn-primary mt-10 w-full text-kiosk-base">
          {isPayment ? 'Close' : 'Back to my order'}
        </button>
      </div>
    </div>
  );
}
