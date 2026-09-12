import { useEffect, useRef, useState } from 'react';
import { Hand, WifiOff } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { displayName } from '../lib/format';
import type { Product } from '../types';

interface AttractScreenProps {
  onStart: () => void;
  /** Long-press the logo for 3s: staff route into the admin panel */
  onAdminHold: () => void;
  offline: boolean;
  /** A few real menu items, rotated, so the idle screen sells something */
  highlights: Product[];
  currencySymbol: string;
}

export function AttractScreen({
  onStart,
  onAdminHold,
  offline,
  highlights,
  currencySymbol,
}: AttractScreenProps) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (highlights.length < 2) return;
    const interval = setInterval(() => setSlide((prev) => (prev + 1) % highlights.length), 4500);
    return () => clearInterval(interval);
  }, [highlights.length]);

  const startHold = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      onAdminHold();
    }, 3000);
  };

  const cancelHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  const handleStart = () => {
    // A completed admin long-press must not also start a customer order
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    if (!offline) onStart();
  };

  const featured = highlights[slide];

  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={offline}
      className="relative flex h-full w-full flex-col items-center overflow-hidden bg-cream-100 text-center disabled:cursor-not-allowed"
      aria-label="Touch anywhere to start your order"
    >
      {/* Brand block: inset and rounded rather than full-bleed */}
      <div className="mx-10 mt-10 flex w-[calc(100%-5rem)] flex-col items-center rounded-panel bg-brand-500 pb-14 pt-14">
        <span
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
        >
          <BrandMark size="lg" />
        </span>
        <p className="mt-8 px-16 text-kiosk-xl font-extrabold text-white">
          Order here, pay by card, take your ticket.
        </p>
      </div>

      {/* Rotating highlight */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-16">
        {offline ? (
          <div className="card flex w-full flex-col items-center gap-6 p-16">
            <WifiOff className="h-24 w-24 text-danger" aria-hidden="true" />
            <p className="text-kiosk-xl font-extrabold text-ink-900">Kiosk unavailable</p>
            <p className="text-kiosk-base text-ink-600">Please order at the counter.</p>
          </div>
        ) : featured ? (
          <div key={featured.id} className="animate-fade-up flex w-full flex-col items-center">
            <div className="flex h-[520px] w-full items-center justify-center overflow-hidden rounded-panel bg-white shadow-card">
              {featured.imageUrl || featured.image ? (
                <img
                  src={featured.imageUrl || featured.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-12 text-kiosk-2xl font-extrabold text-ink-800">
                  {displayName(featured.name)}
                </span>
              )}
            </div>
            <p className="mt-8 text-kiosk-lg font-bold text-ink-800">{displayName(featured.name)}</p>
            <p className="mt-2 text-kiosk-xl font-extrabold text-brand-800">
              {currencySymbol}
              {featured.price.toFixed(2)}
            </p>
          </div>
        ) : null}

        {/* No "from $X" claim: the cheapest line on this menu is a 50c extra,
            so quoting it would be both useless and misleading. */}
        {!offline && (
          <p className="mt-10 text-kiosk-base font-semibold uppercase tracking-[0.2em] text-ink-500">
            Kebabs &middot; Sweets &middot; Fresh Daily
          </p>
        )}
      </div>

      {/* Call to action */}
      {!offline && (
        <div className="flex w-full flex-col items-center gap-8 px-16 pb-20">
          <div className="relative flex items-center justify-center">
            <span
              className="absolute h-44 w-44 rounded-full bg-brand-500/50 animate-pulse-ring"
              aria-hidden="true"
            />
            <span className="relative flex h-44 w-44 items-center justify-center rounded-full bg-brand-500 shadow-lifted">
              <Hand className="h-20 w-20 text-ink-900" aria-hidden="true" />
            </span>
          </div>
          <p className="text-kiosk-3xl font-extrabold uppercase tracking-[0.06em] text-ink-900">
            Touch to start
          </p>
        </div>
      )}
    </button>
  );
}
