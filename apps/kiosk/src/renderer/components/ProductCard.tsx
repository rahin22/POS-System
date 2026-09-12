import { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Product } from '../types';
import { displayName } from '../lib/format';

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
  /** Opens the options sheet */
  onSelect: (product: Product) => void;
  /** Adds straight to the order; only offered when there is nothing to choose */
  onQuickAdd: (product: Product) => void;
  index: number;
}

export function ProductCard({
  product,
  currencySymbol,
  onSelect,
  onQuickAdd,
  index,
}: ProductCardProps) {
  // Menu photos are staff-uploaded URLs; a dead link must not leave an empty block
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed ? undefined : product.imageUrl || product.image;
  const optionCount = (product.modifierGroups || []).length;
  const hasOptions = optionCount > 0;
  const soldOut = !product.isAvailable;

  const handleCard = () => {
    if (soldOut) return;
    if (hasOptions) onSelect(product);
    else onQuickAdd(product);
  };

  return (
    <button
      type="button"
      onClick={handleCard}
      disabled={soldOut}
      style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
      className={`touchable focus-ring group flex animate-fade-up flex-col overflow-hidden rounded-kiosk bg-white text-left shadow-card ${
        soldOut ? 'opacity-60 active:scale-100' : 'hover:ring-4 hover:ring-brand-500'
      }`}
    >
      {/* Only spend vertical space on a picture when there is a real one */}
      {image && (
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-cream-200">
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
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
            <span className="mt-3 inline-block rounded-full bg-cream-300 px-4 py-1.5 text-kiosk-xs font-bold uppercase tracking-wide text-ink-600">
              Sold out
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-kiosk-lg font-extrabold text-brand-800">
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
