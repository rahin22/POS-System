import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, CreditCard, Loader2, RotateCcw, WifiOff } from 'lucide-react';
import { money } from '../lib/format';

export type PaymentStatus =
  /** Confirming the backend is answering BEFORE the terminal is armed */
  | 'checking'
  | 'waiting'
  | 'processing'
  | 'finalising'
  /** Card refused / cancelled / offline: nothing was charged, retrying is safe */
  | 'error'
  /**
   * The backend is not answering, so the terminal was never armed. Nothing was
   * charged and retrying is pointless - this must route to the counter, never
   * back into payment.
   */
  | 'unavailable'
  /** Card WAS charged but the order or ticket failed: retrying would double-charge */
  | 'paid-unfinished';

interface PaymentScreenProps {
  status: PaymentStatus;
  amount: number;
  currencySymbol: string;
  errorTitle?: string;
  errorMessage?: string;
  /** Terminal auth reference, shown to staff when a paid order needs rescuing */
  reference?: string;
  /** When the card was approved, so a missing reference is still reconcilable */
  chargedAt?: Date;
  onRetry: () => void;
  onBackToOrder: () => void;
  onHelp: () => void;
  onDismissPaidUnfinished: () => void;
  /** Ends the order and returns to the attract screen */
  onGiveUp: () => void;
}

export function PaymentScreen({
  status,
  amount,
  currencySymbol,
  errorTitle,
  errorMessage,
  reference,
  chargedAt,
  onRetry,
  onBackToOrder,
  onHelp,
  onDismissPaidUnfinished,
  onGiveUp,
}: PaymentScreenProps) {
  const [slowWarning, setSlowWarning] = useState(false);

  /** Progress of the staff long-press that clears the paid-unfinished screen */
  const [dismissProgress, setDismissProgress] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelDismissHold = () => {
    if (dismissTimer.current) clearInterval(dismissTimer.current);
    dismissTimer.current = null;
    setDismissProgress(0);
  };

  const startDismissHold = () => {
    if (dismissTimer.current) return;
    const startedAt = Date.now();
    dismissTimer.current = setInterval(() => {
      const progress = Math.min(100, ((Date.now() - startedAt) / 3000) * 100);
      setDismissProgress(progress);
      if (progress >= 100) {
        cancelDismissHold();
        onDismissPaidUnfinished();
      }
    }, 50);
  };

  useEffect(() => () => cancelDismissHold(), []);

  useEffect(() => {
    // 'checking' is not listed: the probe is capped at 4s, so a 45s timer could
    // never fire in that state and listing it implied the check might run long.
    if (status !== 'waiting' && status !== 'processing') {
      setSlowWarning(false);
      return;
    }
    const timer = setTimeout(() => setSlowWarning(true), 45 * 1000);
    return () => clearTimeout(timer);
  }, [status]);

  // Card taken, order not recorded: never offer a retry here
  if (status === 'paid-unfinished') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 bg-cream-100 px-12 text-center">
        <span className="flex h-44 w-44 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-24 w-24 text-success" aria-hidden="true" />
        </span>

        <h1 className="text-kiosk-2xl font-extrabold text-ink-900">
          Your payment went through
        </h1>
        <p className="max-w-[820px] text-kiosk-lg text-ink-700">
          We couldn&apos;t send the order to the kitchen. Please show this screen to a staff
          member &mdash; do not pay again.
        </p>

        <div className="card w-full max-w-[820px] p-8">
          <p className="text-kiosk-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
            Payment reference
          </p>
          <p className="mt-2 text-kiosk-xl font-extrabold text-ink-900">
            {reference || 'Not available'}
          </p>
          {/*
            The time matters most in exactly the case the reference is missing:
            staff reconcile against the terminal's own transaction report, where
            "$47.50 at 19:42" is findable and "Not available" is not.
          */}
          <p className="mt-3 text-kiosk-base text-ink-700">
            Amount paid {money(amount, currencySymbol)}
            {chargedAt &&
              ` at ${chargedAt.toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}`}
          </p>
        </div>

        <div className="w-full max-w-[820px] space-y-5">
          <button type="button" onClick={onHelp} className="btn-primary w-full text-kiosk-base">
            Call a staff member
          </button>

          {/*
            Long-press, not a tap.
            This is the only screen where a stray tap costs a customer money they
            cannot prove they spent: the order was never created, so there is
            nothing in the POS to look up, and dismissing clears the auth
            reference. A "Staff:" prefix is a label, not access control — and the
            person standing here is frustrated and looking for a button. Holding
            for 3s is the same gesture that already gates staff access from the
            attract screen.
          */}
          <button
            type="button"
            onPointerDown={startDismissHold}
            onPointerUp={cancelDismissHold}
            onPointerLeave={cancelDismissHold}
            onPointerCancel={cancelDismissHold}
            className="btn-secondary relative w-full overflow-hidden text-kiosk-xs"
          >
            <span
              className="absolute inset-y-0 left-0 bg-danger/20 transition-[width] duration-100 ease-linear"
              style={{ width: `${dismissProgress}%` }}
              aria-hidden="true"
            />
            <span className="relative">
              Staff only: hold for 3 seconds to clear this screen
            </span>
          </button>
        </div>
      </div>
    );
  }

  /*
   * The terminal was never armed, so nothing was charged and there is nothing to
   * retry — the backend is down, and a retry button here would just arm the
   * terminal against a system that cannot record the result. The only honest
   * routes are the counter and a staff member.
   */
  if (status === 'unavailable') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 bg-cream-100 px-12 text-center">
        <span className="flex h-44 w-44 items-center justify-center rounded-full bg-danger/10">
          <WifiOff className="h-24 w-24 text-danger" aria-hidden="true" />
        </span>

        <div>
          <h1 className="text-kiosk-2xl font-extrabold text-ink-900">
            We can&apos;t take your order here
          </h1>
          <p className="mx-auto mt-5 max-w-[820px] text-kiosk-lg text-ink-700">
            The kiosk has lost contact with the kitchen, so we stopped before taking any
            payment. <strong>Nothing has been charged.</strong> Please order at the counter.
          </p>
        </div>

        <div className="w-full max-w-[820px] space-y-5">
          <button type="button" onClick={onGiveUp} className="btn-primary w-full text-kiosk-lg">
            OK, I&apos;ll order at the counter
          </button>
          <button type="button" onClick={onHelp} className="btn-secondary w-full text-kiosk-base">
            Call a staff member
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-10 bg-cream-100 px-12 text-center">
        <span className="flex h-44 w-44 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-24 w-24 text-danger" aria-hidden="true" />
        </span>

        <div>
          <h1 className="text-kiosk-2xl font-extrabold text-ink-900">
            {errorTitle || 'Payment not completed'}
          </h1>
          <p className="mx-auto mt-5 max-w-[820px] text-kiosk-lg text-ink-700">
            {errorMessage || 'Nothing has been charged. You can try again or pay at the counter.'}
          </p>
        </div>

        <div className="w-full max-w-[820px] space-y-5">
          <button type="button" onClick={onRetry} className="btn-primary w-full text-kiosk-lg">
            <RotateCcw className="h-10 w-10" aria-hidden="true" />
            Try payment again
          </button>
          <button type="button" onClick={onBackToOrder} className="btn-secondary w-full text-kiosk-base">
            <ChevronLeft className="h-9 w-9" aria-hidden="true" />
            Back to my order
          </button>
          <button type="button" onClick={onHelp} className="btn-quiet mx-auto text-kiosk-xs">
            Need help?
          </button>
        </div>
      </div>
    );
  }

  // 'checking' shows the spinner too: the terminal is NOT armed yet, so telling
  // the customer to tap their card would be a lie for as long as it lasts.
  const isBusy = status === 'processing' || status === 'finalising' || status === 'checking';

  return (
    <div className="flex h-full flex-col bg-cream-100">
      <div className="mx-10 mt-10 rounded-panel bg-brand-500 px-12 py-10 text-center">
        {/* ink-900 on brand-500, not white: white on this orange is ~1.8:1 and the
            hero figure ~2.0:1, on the amount about to be charged. */}
        <p className="text-kiosk-base font-bold uppercase tracking-[0.25em] text-ink-900/80">
          Amount due
        </p>
        <p className="mt-2 text-kiosk-hero font-extrabold text-ink-900">
          {money(amount, currencySymbol)}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center px-12 pb-10 pt-16 text-center">
        <div aria-live="polite" className="max-w-[860px]">
          {status === 'checking' && (
            <>
              <h1 className="text-kiosk-2xl font-extrabold text-ink-900">Just a moment</h1>
              <p className="mt-6 text-kiosk-lg text-ink-700">
                Checking we can send your order to the kitchen before you pay.
              </p>
            </>
          )}

          {status === 'waiting' && (
            <>
              <h1 className="text-kiosk-2xl font-extrabold text-ink-900">
                Use the card machine
                <br />
                on your right
              </h1>
              <p className="mt-6 text-kiosk-lg text-ink-700">
                Tap, insert or swipe your card there &mdash; not on this screen.
              </p>
            </>
          )}

          {status === 'processing' && (
            <>
              <h1 className="text-kiosk-2xl font-extrabold text-ink-900">Processing payment</h1>
              <p className="mt-6 text-kiosk-lg text-ink-700">
                Follow the prompts on the card machine. Please don&apos;t walk away.
              </p>
            </>
          )}

          {status === 'finalising' && (
            <>
              <h1 className="text-kiosk-2xl font-extrabold text-ink-900">Payment approved</h1>
              <p className="mt-6 text-kiosk-lg text-ink-700">
                Sending your order to the kitchen and printing your ticket. Please don&apos;t walk away.
              </p>
            </>
          )}
        </div>

        {/* Geometry matters here: the terminal is physically to the right of the panel */}
        <div className="mt-14 flex w-full max-w-[900px] items-center justify-end gap-8">
          {isBusy ? (
            <span className="flex h-56 w-56 items-center justify-center rounded-full bg-white shadow-card">
              <Loader2 className="h-28 w-28 animate-spin text-brand-700" aria-hidden="true" />
            </span>
          ) : (
            <>
              <ArrowRight
                className="h-28 w-28 animate-nudge-right text-brand-700"
                strokeWidth={2.5}
                aria-hidden="true"
              />
              {/* Rough PAX silhouette: screen above, keypad below */}
              <span className="flex h-[340px] w-60 flex-col items-center gap-3 rounded-[2rem] border-4 border-ink-800 bg-white p-5 shadow-lifted">
                <span className="flex h-28 w-full flex-col items-center justify-center rounded-2xl bg-ink-900 px-3">
                  <span className="text-kiosk-xs font-extrabold text-brand-400">
                    {money(amount, currencySymbol)}
                  </span>
                  <CreditCard className="mt-2 h-10 w-10 text-white" aria-hidden="true" />
                </span>
                <span className="grid w-full flex-1 grid-cols-3 gap-2" aria-hidden="true">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <span key={index} className="rounded-lg bg-cream-300" />
                  ))}
                </span>
                <span className="text-kiosk-xs font-extrabold uppercase tracking-widest text-ink-600">
                  Card machine
                </span>
              </span>
            </>
          )}
        </div>

        {slowWarning && (
          <div className="card mt-14 flex w-full max-w-[860px] items-center justify-between gap-6 p-7">
            <p className="text-left text-kiosk-xs font-semibold text-ink-700">
              This is taking longer than usual.
            </p>
            <button type="button" onClick={onHelp} className="btn-secondary px-8 text-kiosk-xs">
              Get help
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 px-12 pb-12">
        {/*
          There is deliberately no in-app cancel here. The transaction is live on
          the PAX terminal and SmartConnect gives us no way to call it back, so a
          button that only changed screens would leave the terminal armed and the
          Pay button dead. Cancelling happens on the terminal itself.
        */}
        {status === 'waiting' ? (
          <div className="card flex items-center justify-between gap-6 p-8">
            <p className="text-left text-kiosk-base font-semibold text-ink-700">
              Changed your mind? Press the red &#10007; key (bottom left) on the card machine.
            </p>
            <button type="button" onClick={onHelp} className="btn-secondary shrink-0 px-10 text-kiosk-xs">
              Help
            </button>
          </div>
        ) : status === 'checking' ? (
          // Nothing is paid and the terminal is not armed; if the probe fails the
          // next screen says we cannot take the order at all.
          <p className="text-center text-kiosk-base font-semibold text-ink-600">
            One moment &mdash; you haven&apos;t been charged yet.
          </p>
        ) : (
          <p className="text-center text-kiosk-base font-semibold text-ink-600">
            Almost done&hellip;
          </p>
        )}
      </div>
    </div>
  );
}
