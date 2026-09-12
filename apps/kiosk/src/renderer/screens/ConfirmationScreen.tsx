import { useEffect, useState } from 'react';
import { ArrowDown, CheckCircle2, PrinterX } from 'lucide-react';

interface ConfirmationScreenProps {
  orderNumber: number;
  printed: boolean;
  autoCloseSeconds?: number;
  onDone: () => void;
}

export function ConfirmationScreen({
  orderNumber,
  printed,
  autoCloseSeconds = 25,
  onDone,
}: ConfirmationScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);

  useEffect(() => {
    // Without a printed ticket this screen is the customer's only record,
    // so it must stay up until a person dismisses it.
    if (!printed) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // onDone is stable for the life of this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printed]);

  // When no ticket printed, the number on screen is the only proof the customer has
  if (!printed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 bg-cream-100 px-12 text-center">
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-danger/10">
          <PrinterX className="h-16 w-16 text-danger" aria-hidden="true" />
        </span>
        <h1 className="text-kiosk-xl font-extrabold text-ink-900">No ticket printed</h1>
        <p className="max-w-[820px] text-kiosk-lg text-ink-700">
          Your order is paid and with the kitchen. Show this number to staff.
        </p>

        <p className="mt-2 text-[16rem] font-extrabold leading-none text-brand-800">{orderNumber}</p>

        <button type="button" onClick={onDone} className="btn-primary w-full max-w-[820px] text-kiosk-lg">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-cream-100">
      <div className="mx-10 mt-10 flex flex-col items-center rounded-panel bg-brand-500 px-12 pb-12 pt-12 text-center">
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white/25">
          <CheckCircle2 className="h-16 w-16 text-white" aria-hidden="true" />
        </span>
        <h1 className="mt-6 text-kiosk-2xl font-extrabold text-white">Order confirmed</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-12 text-center">
        <p className="text-kiosk-base font-bold uppercase tracking-[0.3em] text-ink-500">
          Your order number
        </p>
        <p className="animate-scale-in text-[16rem] font-extrabold leading-none text-brand-800">
          {orderNumber}
        </p>
        <p className="mt-6 text-kiosk-lg font-semibold text-ink-800">
          We&apos;ll call number {orderNumber} at the counter.
        </p>
      </div>

      <div className="flex flex-col items-center gap-8 px-12 pb-14">
        <div className="card flex w-full max-w-[860px] items-center gap-7 p-8 text-left">
          <ArrowDown className="h-16 w-16 shrink-0 animate-bounce text-brand-600" aria-hidden="true" />
          <div>
            <p className="text-kiosk-base font-extrabold text-ink-900">Take your ticket below</p>
            <p className="mt-1 text-kiosk-xs text-ink-600">
              Keep it until your number is called.
            </p>
          </div>
        </div>

        <button type="button" onClick={onDone} className="btn-primary w-full max-w-[860px] text-kiosk-lg">
          Done
        </button>

        <p className="text-kiosk-xs text-ink-500" aria-live="polite">
          This screen clears in {secondsLeft}s
        </p>
      </div>
    </div>
  );
}
