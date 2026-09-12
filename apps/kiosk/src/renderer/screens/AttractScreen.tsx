import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, WifiOff } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { displayName } from '../lib/format';
import type { Product } from '../types';

/**
 * ready       - menu loaded and the backend answered on the last attempt
 * loading     - first load has not resolved yet (cold boot, power cut)
 * unavailable - the last fetch failed, so the menu on screen may be stale and,
 *               more importantly, createPaidOrder is likely to fail AFTER the
 *               card has been charged. Ordering must be blocked here.
 */
export type KioskStatus = 'ready' | 'loading' | 'unavailable';

interface AttractScreenProps {
  onStart: () => void;
  /** Long-press the logo for 3s: staff route into the admin panel */
  onAdminHold: () => void;
  status: KioskStatus;
  /** A few real menu items, rotated, so the idle screen sells something */
  highlights: Product[];
  currencySymbol: string;
}

/** A click landing within this long after a completed long-press is the same gesture */
const HOLD_SWALLOW_MS = 400;

export function AttractScreen({
  onStart,
  onAdminHold,
  status,
  highlights,
  currencySymbol,
}: AttractScreenProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * When the long-press completed, not whether it did.
   *
   * A boolean latch here had no guaranteed clear path: if the staff member slid
   * their finger off the PIN dialog instead of lifting cleanly, no click was ever
   * dispatched, the latch stayed set, and the NEXT customer's first tap on "Start
   * order" was silently swallowed. A timestamp expires on its own.
   */
  const holdCompletedAt = useRef(0);
  const [slide, setSlide] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const canStart = status === 'ready';

  // Menu reloads can shorten the list while this is mounted; an index left past
  // the end would blank the panel until the next tick.
  useEffect(() => {
    setSlide(0);
  }, [highlights.length]);

  /**
   * Staff fixing a broken photo URL in the POS should see it appear here. This
   * screen stays mounted for weeks, so a permanent failure map would keep showing
   * the text fallback until someone restarted the app.
   */
  useEffect(() => {
    setFailedImages({});
  }, [highlights]);

  useEffect(() => {
    if (highlights.length < 2) return;
    const interval = setInterval(() => setSlide((prev) => (prev + 1) % highlights.length), 4500);
    return () => clearInterval(interval);
  }, [highlights.length]);

  const featured = highlights.length > 0 ? highlights[slide % highlights.length] : null;

  // Warm the next photo so the rotation does not flash an empty panel
  useEffect(() => {
    if (highlights.length < 2) return;
    const next = highlights[(slide + 1) % highlights.length];
    const url = next?.imageUrl || next?.image;
    if (url) new Image().src = url;
  }, [slide, highlights]);

  const startHold = () => {
    // Single slot: a second pointer landing on the logo (a child mashing the panel,
    // a palm across the top) would otherwise orphan the first handle, and the
    // orphan still fires at 3s and opens the staff PIN dialog in front of a customer.
    if (holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      holdCompletedAt.current = Date.now();
      onAdminHold();
    }, 3000);
  };

  const cancelHold = () => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  useEffect(() => () => cancelHold(), []);

  const handleStart = () => {
    // A completed admin long-press must not also start a customer order
    if (Date.now() - holdCompletedAt.current < HOLD_SWALLOW_MS) return;
    if (canStart) onStart();
  };

  const featuredImage =
    featured && !failedImages[featured.id] ? featured.imageUrl || featured.image : undefined;

  return (
    // A plain container rather than a button: the screen still starts an order
    // wherever it is tapped, but the real <button> below can then be nested
    // inside it, which a button-in-button would not allow.
    <div
      onClick={handleStart}
      className="relative flex h-full w-full flex-col items-center overflow-hidden bg-cream-100 text-center"
    >
      {/* Brand block: inset and rounded rather than full-bleed */}
      <div className="mx-10 mt-10 flex w-[calc(100%-5rem)] flex-col items-center rounded-panel bg-brand-500 pb-14 pt-14">
        <span
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
        >
          <BrandMark size="lg" />
        </span>
        <p className="mt-8 px-16 text-kiosk-xl font-extrabold text-ink-900">
          Order here, pay by card, take your ticket.
        </p>
      </div>

      {/* Showcase */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-16">
        {status === 'unavailable' ? (
          <div className="card flex w-full flex-col items-center gap-6 p-16">
            <WifiOff className="h-24 w-24 text-danger" aria-hidden="true" />
            <p className="text-kiosk-xl font-extrabold text-ink-900">Kiosk unavailable</p>
            <p className="text-kiosk-base text-ink-700">Please order at the counter.</p>
          </div>
        ) : status === 'loading' ? (
          <div className="flex w-full flex-col items-center gap-6">
            <Loader2 className="h-24 w-24 animate-spin text-brand-600" aria-hidden="true" />
            <p className="text-kiosk-base font-semibold text-ink-700">Getting today&apos;s menu…</p>
          </div>
        ) : featured ? (
          /*
           * Deliberately NOT a white card with a shadow. Shaped like a product card
           * it invites a tap that would appear to add that item, when the next screen
           * is the order-type question with the item nowhere in sight.
           */
          <div key={featured.id} className="animate-fade-up flex w-full flex-col items-center">
            <p className="mb-5 text-kiosk-xs font-extrabold uppercase tracking-[0.2em] text-ink-600">
              Popular right now
            </p>

            <div className="flex h-[460px] w-[80%] items-center justify-center overflow-hidden rounded-panel bg-cream-200">
              {featuredImage ? (
                <img
                  src={featuredImage}
                  alt=""
                  onError={() => setFailedImages((prev) => ({ ...prev, [featured.id]: true }))}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-12 text-kiosk-2xl font-extrabold text-ink-800">
                  {displayName(featured.name)}
                </span>
              )}
            </div>

            <p className="mt-7 text-kiosk-lg font-bold text-ink-800">{displayName(featured.name)}</p>
            <p className="mt-2 text-kiosk-xl font-extrabold text-brand-800">
              {currencySymbol}
              {featured.price.toFixed(2)}
            </p>

            {/*
              A progress bar, not carousel dots: dots are the standard mobile
              affordance for a control you can tap, and these are not tappable.
            */}
            {highlights.length > 1 && (
              <div
                className="mt-7 h-2 w-64 overflow-hidden rounded-full bg-cream-300"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
                  style={{ width: `${((slide % highlights.length) + 1) * (100 / highlights.length)}%` }}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Call to action */}
      {canStart ? (
        <div className="flex w-full flex-col items-center gap-6 px-16 pb-20">
          {/*
            No infinite pulse behind this. The panel runs ~16 hours a day and a
            680x152 element compositing forever is a real thermal cost for a button
            nobody is failing to find.
          */}
          <button
            type="button"
            onClick={(e) => {
              // The container behind this also starts an order; without this the
              // handler would run twice on every press of the button.
              e.stopPropagation();
              handleStart();
            }}
            className="touchable focus-ring flex h-[152px] w-[680px] items-center justify-center gap-8 rounded-full bg-brand-500 text-kiosk-2xl font-extrabold text-ink-900 shadow-lifted active:bg-brand-600"
          >
            <span>Start order</span>
            <ArrowRight className="h-16 w-16 animate-nudge-right" aria-hidden="true" />
          </button>
          <p className="text-kiosk-base font-semibold text-ink-600">or touch anywhere to begin</p>
        </div>
      ) : (
        <div className="h-[280px]" aria-hidden="true" />
      )}
    </div>
  );
}
