import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, CreditCard, Loader2, RotateCcw } from 'lucide-react';
import { money } from '../lib/format';

export type PaymentStatus =
  | 'waiting'
  | 'processing'
  | 'finalising'
  /** Card refused / cancelled / offline: nothing was charged, retrying is safe */
  | 'error'
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
  onRetry: () => void;
  onBackToOrder: () => void;
  onHelp: () => void;
  onDismissPaidUnfinished: () => void;
}

export function PaymentScreen({
  status,
  amount,
  currencySymbol,
  errorTitle,
  errorMessage,
  reference,
  onRetry,
  onBackToOrder,
  onHelp,
  onDismissPaidUnfinished,
}: PaymentScreenProps) {
  const [slowWarning, setSlowWarning] = useState(false);

  useEffect(() => {
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
          <p className="text-kiosk-xs font-semibold uppercase tracking-[0.2em] text-ink-500">
            Payment reference
          </p>
          <p className="mt-2 text-kiosk-xl font-extrabold text-ink-900">{reference || 'Not available'}</p>
          <p className="mt-3 text-kiosk-base text-ink-700">
            Amount paid {money(amount, currencySymbol)}
          </p>
        </div>

        <div className="w-full max-w-[820px] space-y-5">
          <button type="button" onClick={onHelp} className="btn-primary w-full text-kiosk-base">
            Call a staff member
          </button>
          <button
            type="button"
            onClick={onDismissPaidUnfinished}
            className="btn-secondary w-full text-kiosk-base"
          >
            Staff: finish and reset
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

  const isBusy = status === 'processing' || status === 'finalising';

  return (
    <div className="flex h-full flex-col bg-cream-100">
      <div className="mx-10 mt-10 rounded-panel bg-brand-500 px-12 py-10 text-center">
        <p className="text-kiosk-base font-bold uppercase tracking-[0.25em] text-white/90">
          Amount due
        </p>
        <p className="mt-2 text-kiosk-hero font-extrabold text-white">
          {money(amount, currencySymbol)}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center px-12 pb-10 pt-16 text-center">
        <div aria-live="polite" className="max-w-[860px]">
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
              <Loader2 className="h-28 w-28 animate-spin text-brand-600" aria-hidden="true" />
            </span>
          ) : (
            <>
              <ArrowRight
                className="h-28 w-28 animate-nudge-right text-brand-600"
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
        ) : (
          <p className="text-center text-kiosk-base font-semibold text-ink-600">
            Almost done&hellip;
          </p>
        )}
      </div>
    </div>
  );
}
