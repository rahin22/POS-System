import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, HelpCircle, RefreshCw, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { CategoryCard } from '../components/CategoryCard';
import { CategorySheet } from './CategorySheet';
import { BrandMark } from '../components/BrandMark';
import type { Category, MenuLayout, OrderType, Product } from '../types';
import { displayName, money } from '../lib/format';

interface MenuScreenProps {
  /** 'cards' shows a category grid that opens a product sheet; 'scroll' is one long menu */
  layout: MenuLayout;
  categories: Category[];
  productsByCategory: (categoryId: string) => Product[];
  currencySymbol: string;
  orderType: OrderType;
  itemCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onSelectProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onViewOrder: () => void;
  onChangeOrderType: () => void;
  onCancelOrder: () => void;
  onHelp: () => void;
}

export function MenuScreen({
  layout,
  categories,
  productsByCategory,
  currencySymbol,
  orderType,
  itemCount,
  total,
  isLoading,
  error,
  onReload,
  onSelectProduct,
  onQuickAdd,
  onViewOrder,
  onChangeOrderType,
  onCancelOrder,
  onHelp,
}: MenuScreenProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isJumping = useRef(false);

  // The whole menu is one scroll; the rail reflects where you are in it
  const syncActiveFromScroll = useCallback(() => {
    if (isJumping.current) return;
    const container = scrollRef.current;
    if (!container) return;

    const probeLine = container.getBoundingClientRect().top + 140;
    let current: string | null = null;

    for (const category of categories) {
      const section = sectionRefs.current[category.id];
      if (!section) continue;
      if (section.getBoundingClientRect().top <= probeLine) current = category.id;
    }

    setActiveCategoryId(current ?? categories[0]?.id ?? null);
  }, [categories]);

  useEffect(() => {
    if (layout !== 'scroll') return;
    const container = scrollRef.current;
    if (!container) return;
    syncActiveFromScroll();
    container.addEventListener('scroll', syncActiveFromScroll, { passive: true });
    return () => container.removeEventListener('scroll', syncActiveFromScroll);
  }, [layout, syncActiveFromScroll]);

  // Keep the active chip visible — a rail you can't see the end of is useless
  useEffect(() => {
    if (layout !== 'scroll' || !activeCategoryId) return;
    chipRefs.current[activeCategoryId]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [layout, activeCategoryId]);

  const jumpToCategory = (categoryId: string) => {
    const section = sectionRefs.current[categoryId];
    const container = scrollRef.current;
    if (!section || !container) return;

    const target = section.offsetTop - 24;
    isJumping.current = true;
    setActiveCategoryId(categoryId);
    container.scrollTo({ top: target, behavior: 'smooth' });

    // A jump across 18 categories can be 10,000px+, so release the scroll-spy
    // when the scroll actually settles rather than after a guessed delay.
    const release = () => {
      if (Math.abs(container.scrollTop - target) < 4) {
        isJumping.current = false;
        clearInterval(poll);
        clearTimeout(failsafe);
      }
    };
    const poll = setInterval(release, 100);
    const failsafe = setTimeout(() => {
      isJumping.current = false;
      clearInterval(poll);
    }, 4000);
  };

  useEffect(() => {
    if (layout !== 'cards') setOpenCategoryId(null);
  }, [layout]);

  const openCategory = categories.find((category) => category.id === openCategoryId) || null;

  /** Thumbnail for a category tile: the first product in it that has a photo */
  const categoryThumbnail = (categoryId: string) =>
    productsByCategory(categoryId)
      .map((product) => product.imageUrl || product.image)
      .find((url): url is string => Boolean(url));

  return (
    <div className="flex h-full flex-col bg-cream-100">
      {/* Header */}
      <header className="shrink-0 bg-cream-50 px-12 pb-5 pt-8 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <BrandMark size="sm" />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onChangeOrderType}
              className="touchable focus-ring flex items-center gap-3 rounded-full border-2 border-cream-400 bg-white px-6 py-3"
            >
              {orderType === 'dine-in' ? (
                <UtensilsCrossed className="h-8 w-8 text-brand-600" aria-hidden="true" />
              ) : (
                <ShoppingBag className="h-8 w-8 text-brand-600" aria-hidden="true" />
              )}
              <span className="text-kiosk-xs font-bold text-ink-800">
                {orderType === 'dine-in' ? 'Eat In' : 'Take Away'}
              </span>
              <span className="text-kiosk-xs font-bold text-brand-600">Change</span>
            </button>

            <button
              type="button"
              onClick={onHelp}
              aria-label="Need help?"
              className="touchable focus-ring flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-cream-400 bg-white text-ink-600"
            >
              <HelpCircle className="h-9 w-9" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onCancelOrder}
              aria-label="Cancel order"
              className="touchable focus-ring flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-cream-400 bg-white text-ink-600"
            >
              <X className="h-9 w-9" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Category rail: jump-navigation for the single scrolling menu */}
        {layout === 'scroll' && (
        <div ref={railRef} className="hide-scrollbar rail-fade -mx-12 mt-6 overflow-x-auto px-12">
          <div className="flex min-w-max gap-3">
            {isLoading && categories.length === 0
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-[76px] w-56 animate-pulse rounded-full bg-cream-300" />
                ))
              : categories.map((category) => {
                  const isActive = category.id === activeCategoryId;
                  return (
                    <button
                      key={category.id}
                      ref={(element) => (chipRefs.current[category.id] = element)}
                      type="button"
                      onClick={() => jumpToCategory(category.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={`touchable focus-ring whitespace-nowrap rounded-full px-8 text-kiosk-xs font-extrabold ${
                        isActive
                          ? 'bg-brand-500 text-ink-900 shadow-card'
                          : 'border-2 border-cream-400 bg-white text-ink-700 hover:bg-cream-200'
                      }`}
                      style={{ minHeight: '76px' }}
                    >
                      {displayName(category.name)}
                    </button>
                  );
                })}
          </div>
        </div>
        )}
      </header>

      {/* One continuous menu, divided by category */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 pb-10 pt-8">
        {error ? (
          <div className="card mx-auto mt-24 flex max-w-2xl flex-col items-center gap-8 p-14 text-center">
            <p className="text-kiosk-xl font-extrabold text-ink-900">We couldn&apos;t load the menu</p>
            <p className="text-kiosk-base text-ink-600">{error}</p>
            <button type="button" onClick={onReload} className="btn-primary text-kiosk-base">
              <RefreshCw className="h-8 w-8" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-kiosk bg-cream-200" />
            ))}
          </div>
        ) : layout === 'cards' ? (
          <>
            <h2 className="mb-7 text-kiosk-xl font-extrabold text-ink-900">Explore our menu</h2>
            <div className="grid grid-cols-2 gap-7">
              {categories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  name={category.name}
                  productCount={productsByCategory(category.id).length}
                  imageUrl={categoryThumbnail(category.id)}
                  index={index}
                  onSelect={() => setOpenCategoryId(category.id)}
                />
              ))}
            </div>
          </>
        ) : (
          categories.map((category) => {
            const products = productsByCategory(category.id);
            if (products.length === 0) return null;

            return (
              <section
                key={category.id}
                ref={(element) => (sectionRefs.current[category.id] = element)}
                className="scroll-mt-6 pb-12 pt-4"
              >
                <div className="mb-6 flex items-baseline gap-5">
                  <h2 className="text-kiosk-xl font-extrabold text-ink-900">
                    {displayName(category.name)}
                  </h2>
                  <span className="text-kiosk-xs font-semibold text-ink-500">
                    {products.length} item{products.length === 1 ? '' : 's'}
                  </span>
                  <span className="h-[3px] flex-1 rounded-full bg-cream-400" aria-hidden="true" />
                </div>

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
              </section>
            );
          })
        )}
      </div>

      {/* Order bar: fixed height so the grid never jumps when the first item lands */}
      <footer className="shrink-0 bg-cream-50 px-12 py-7 shadow-bar">
        <div className="flex h-[104px] items-center">
          {itemCount === 0 ? (
            <p className="w-full text-center text-kiosk-sm font-semibold text-ink-500">
              {layout === 'cards'
                ? "Tap a category to see what's inside"
                : 'Tap an item to add it to your order'}
            </p>
          ) : (
            <button
              type="button"
              onClick={onViewOrder}
              className="btn-primary w-full animate-scale-in justify-between text-kiosk-lg"
            >
              <span className="flex items-center gap-5">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink-900 text-kiosk-base font-extrabold text-brand-400">
                  {itemCount}
                </span>
                View order
              </span>
              <span className="flex items-center gap-4">
                {money(total, currencySymbol)}
                <ChevronRight className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </footer>

      {openCategory && (
        <CategorySheet
          categoryName={openCategory.name}
          products={productsByCategory(openCategory.id)}
          currencySymbol={currencySymbol}
          itemCount={itemCount}
          total={total}
          onSelectProduct={onSelectProduct}
          onQuickAdd={onQuickAdd}
          onViewOrder={onViewOrder}
          onClose={() => setOpenCategoryId(null)}
        />
      )}
    </div>
  );
}
