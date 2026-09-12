import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import type { Product } from '../types';
import { displayName, money } from '../lib/format';

interface CategorySheetProps {
  categoryName: string;
  products: Product[];
  currencySymbol: string;
  itemCount: number;
  total: number;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onViewOrder: () => void;
  onClose: () => void;
}

/**
 * Products for one category, opened from the category grid.
 *
 * Sits at z-40 so the item options sheet (z-50), the inactivity prompt (z-60)
 * and confirm dialogs (z-70) all still layer above it. Checkout stays reachable
 * from in here so a customer never has to back out to pay.
 */
export function CategorySheet({
  categoryName,
  products,
  currencySymbol,
  itemCount,
  total,
  onSelectProduct,
  onQuickAdd,
  onViewOrder,
  onClose,
}: CategorySheetProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-ink-900/50">
      <div className="animate-fade-up flex h-[94%] flex-col overflow-hidden rounded-t-[2.5rem] bg-cream-100">
        <header className="flex shrink-0 items-center justify-between gap-6 bg-cream-50 px-12 py-7 shadow-card">
          <div>
            <h2 className="text-kiosk-xl font-extrabold text-ink-900">
              {displayName(categoryName)}
            </h2>
            <p className="mt-1 text-kiosk-xs font-semibold text-ink-500">
              {products.length} item{products.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Back to all categories"
            className="touchable focus-ring flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border-2 border-cream-400 bg-white text-ink-700"
          >
            <X className="h-11 w-11" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-12 py-8">
          <div className="grid grid-cols-2 gap-7">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                currencySymbol={currencySymbol}
                onSelect={onSelectProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        </div>

        <footer className="shrink-0 bg-cream-50 px-12 py-6 shadow-bar">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onClose}
              className={`btn-secondary text-kiosk-base ${itemCount === 0 ? 'w-full' : 'px-10'}`}
            >
              <ChevronLeft className="h-9 w-9" aria-hidden="true" />
              All categories
            </button>

            {itemCount > 0 && (
              <button
                type="button"
                onClick={onViewOrder}
                className="btn-primary flex-1 animate-scale-in justify-between text-kiosk-base"
              >
                <span className="flex items-center gap-4">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-900 text-kiosk-xs font-extrabold text-brand-400">
                    {itemCount}
                  </span>
                  View order
                </span>
                <span className="flex items-center gap-3">
                  {money(total, currencySymbol)}
                  <ChevronRight className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
