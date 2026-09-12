import { Check, ChevronLeft, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import type { OrderType } from '../types';

interface OrderTypeScreenProps {
  onSelect: (type: OrderType) => void;
  /** Leaves without changing anything: back to the menu, or cancel at the start */
  onBack: () => void;
  /**
   * Set once the customer has already chosen. Reaching this screen again from the
   * menu is a change, not a fresh start, so the exit must not discard the order.
   */
  currentType?: OrderType | null;
  isChanging: boolean;
  /** Shown when changing, so the customer can see their order survived the detour */
  itemCount: number;
  total: number;
  currencySymbol: string;
}

const OPTIONS: Array<{
  type: OrderType;
  title: string;
  caption: string;
  Icon: typeof UtensilsCrossed;
}> = [
  {
    type: 'dine-in',
    title: 'Eat In',
    caption: 'Served on a tray',
    Icon: UtensilsCrossed,
  },
  {
    type: 'takeaway',
    title: 'Take Away',
    caption: 'Packed and bagged',
    Icon: ShoppingBag,
  },
];

export function OrderTypeScreen({
  onSelect,
  onBack,
  currentType,
  isChanging,
  itemCount,
  total,
  currencySymbol,
}: OrderTypeScreenProps) {
  return (
    <div className="flex h-full flex-col bg-cream-100">
      <header className="mx-10 mt-10 flex shrink-0 flex-col items-center rounded-panel bg-brand-500 pb-12 pt-12">
        <BrandMark size="md" />
        <h1 className="mt-8 px-12 text-center text-kiosk-2xl font-extrabold text-ink-900">
          {isChanging ? 'Change your order type' : 'Eating in, or taking away?'}
        </h1>
        {/* kiosk-sm, not kiosk-xs: this is the one thing the detouring customer is
            anxious about, so it must not be the smallest text on the screen. */}
        {isChanging && itemCount > 0 && (
          <p className="mt-5 rounded-full bg-ink-900/10 px-8 py-3 text-kiosk-sm font-extrabold text-ink-900">
            {itemCount} item{itemCount === 1 ? '' : 's'} &middot; {currencySymbol}
            {total.toFixed(2)} still in your order
          </p>
        )}
      </header>

      {/* flex-1 rather than a fixed card height: a bottom-pinned footer under
          fixed cards left roughly a third of the panel empty, which reads as a
          page that has not finished loading. */}
      <div className="grid flex-1 grid-cols-2 gap-8 px-10 py-12">
        {OPTIONS.map(({ type, title, caption, Icon }, index) => {
          const isSelected = isChanging && currentType === type;

          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              style={{ animationDelay: `${index * 60}ms` }}
              aria-pressed={isSelected}
              className={`touchable focus-ring group relative flex h-full animate-fade-up flex-col items-center justify-center gap-8 rounded-panel px-8 shadow-card ${
                isSelected
                  ? 'bg-brand-100 ring-4 ring-brand-600'
                  : 'bg-white active:ring-4 active:ring-brand-500'
              }`}
            >
              {isSelected && (
                <span className="absolute right-7 top-7 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500">
                  <Check className="h-10 w-10 text-ink-900" strokeWidth={3} aria-hidden="true" />
                </span>
              )}

              <span
                className={`flex h-56 w-56 items-center justify-center rounded-full transition-colors duration-200 ${
                  isSelected ? 'bg-brand-500' : 'bg-brand-100'
                }`}
              >
                <Icon
                  className={`h-28 w-28 ${isSelected ? 'text-ink-900' : 'text-brand-700'}`}
                  aria-hidden="true"
                />
              </span>
              <span className="text-center">
                <span className="block text-kiosk-2xl font-extrabold text-ink-900">{title}</span>
                <span className="mt-3 block text-kiosk-base text-ink-600">{caption}</span>
                {isSelected && (
                  <span className="mt-4 block text-kiosk-xs font-extrabold uppercase tracking-wide text-brand-700">
                    Current choice
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-end justify-center px-10 pb-14">
        {/*
          Reaching this screen from the menu is a change of mind about eating in, not
          an attempt to bin the order. Offering "Cancel" there discarded the whole
          basket for anyone who opened it to look and then backed out.
        */}
        {isChanging ? (
          <button type="button" onClick={onBack} className="btn-secondary w-full text-kiosk-base">
            <ChevronLeft className="h-9 w-9" aria-hidden="true" />
            Back to my order
          </button>
        ) : (
          <button type="button" onClick={onBack} className="btn-quiet mx-auto text-kiosk-base">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
