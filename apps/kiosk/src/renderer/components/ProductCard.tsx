import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Product } from '../types';
import { displayName } from '../lib/format';
import { hasChoosableGroups } from '../lib/modifiers';

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
  /** Opens the options sheet */
  onSelect: (product: Product) => void;
  /** Adds straight to the order; only offered when there is nothing to choose */
  onQuickAdd: (product: Product) => void;
  /** Answers a tap on a sold-out card, so it is never silently inert */
  onSoldOut: (product: Product) => void;
  index: number;
}

export function ProductCard({
  product,
  currencySymbol,
  onSelect,
  onQuickAdd,
  onSoldOut,
  index,
}: ProductCardProps) {
  // Menu photos are staff-uploaded URLs; a dead link must not leave an empty block
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed ? undefined : product.imageUrl || product.image;
  // Same normaliser the sheet uses: reading the raw groups meant a product whose
  // only group was empty still opened a sheet with no groups and a bare
  // "Add to order".
  const hasOptions = hasChoosableGroups(product);
  const soldOut = !product.isAvailable;

  const handleCard = () => {
    // Never silently inert: on a kiosk, "nothing happened" reads as "broken" and
    // the customer's next move is to tap harder.
    if (soldOut) {
      onSoldOut(product);
      return;
    }
    if (hasOptions) onSelect(product);
    else onQuickAdd(product);
  };

  return (
    <button
      type="button"
      onClick={handleCard}
      style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
      className={`touchable focus-ring group flex animate-fade-up flex-col overflow-hidden rounded-kiosk text-left shadow-card ${
        soldOut ? 'bg-cream-200' : 'bg-white hover:ring-4 hover:ring-brand-500'
      }`}
    >
      {/* Only spend vertical space on a picture when there is a real one */}
      {image && (
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-cream-200">
          {/*
            Dim the PHOTO, not the card. A blanket opacity dragged the "Sold out"
            chip and the price to under 3:1 — making the one label whose job is to
            explain why the card is inert the hardest thing on it to read.
          */}
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover transition-transform duration-300 ${
              soldOut ? 'opacity-40 grayscale' : 'group-hover:scale-[1.04]'
            }`}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col justify-between gap-5 p-7">
        <div>
          <h3 className="text-kiosk-base font-extrabold leading-tight text-ink-900 line-clamp-2">
            {displayName(product.name)}
          </h3>
          {product.description && (
            <p className="mt-2 text-kiosk-xs text-ink-600 line-clamp-2">{product.description}</p>
          )}
          {soldOut && (
            <span className="mt-3 inline-block rounded-full bg-ink-900 px-5 py-2 text-kiosk-xs font-extrabold uppercase tracking-wide text-white">
              Sold out today
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span
            className={`text-kiosk-lg font-extrabold ${soldOut ? 'text-ink-600' : 'text-brand-800'}`}
          >
            {currencySymbol}
            {product.price.toFixed(2)}
          </span>

          {!soldOut &&
            (hasOptions ? (
              <span className="flex h-[72px] items-center gap-2 rounded-full border-2 border-brand-500 px-7 text-kiosk-xs font-extrabold text-brand-800">
                Choose
                <ChevronRight className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <span
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-500 text-ink-900 shadow-card transition-colors duration-200 group-hover:bg-brand-400"
                aria-hidden="true"
              >
                <Plus className="h-10 w-10" strokeWidth={3} />
              </span>
            ))}
        </div>
      </div>
    </button>
  );
}
