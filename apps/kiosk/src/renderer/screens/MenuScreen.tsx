import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronRight, HelpCircle, RefreshCw, ShoppingBag, UtensilsCrossed, X } from 'lucide-react';
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
  onSoldOut: (product: Product) => void;
  onViewOrder: () => void;
  /** False in a takeaway-only shop: the chip must not be a way back in */
  canChangeOrderType: boolean;
  onChangeOrderType: () => void;
  onCancelOrder: () => void;
  onHelp: () => void;
  /**
   * Owned by App so it survives the trip to the cart and back. Adding one item to
   * an 18-category menu and returning to the very top is the single most annoying
   * thing a long kiosk menu can do. Reset to 0 when the order resets.
   */
  scrollTopRef: React.MutableRefObject<number>;
}

/**
 * Counts only what can actually be bought. At close-out a tile promising
 * "8 items" that opens onto two available ones is a small lie the customer
 * discovers after tapping.
 */
const availableCount = (products: Product[]) =>
  products.filter((product) => product.isAvailable).length;

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
  onSoldOut,
  onViewOrder,
  canChangeOrderType,
  onChangeOrderType,
  onCancelOrder,
  onHelp,
  scrollTopRef,
}: MenuScreenProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isJumping = useRef(false);

  // Position tracking runs in BOTH layouts: the category grid is 18 tiles over two
  // columns, so a cards-layout customer loses their place on a trip to the cart
  // exactly as a scroll-layout one does. Only the rail scroll-spy is scroll-only.
  const syncActiveFromScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Remembered even mid-jump, so leaving for the cart always returns here
    scrollTopRef.current = container.scrollTop;

    if (layout !== 'scroll' || isJumping.current) return;

    const probeLine = container.getBoundingClientRect().top + 140;
    let current: string | null = null;

    for (const category of categories) {
      const section = sectionRefs.current[category.id];
      if (!section) continue;
      if (section.getBoundingClientRect().top <= probeLine) current = category.id;
    }

    setActiveCategoryId(current ?? categories[0]?.id ?? null);
  }, [categories, layout, scrollTopRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    syncActiveFromScroll();
    container.addEventListener('scroll', syncActiveFromScroll, { passive: true });
    return () => container.removeEventListener('scroll', syncActiveFromScroll);
  }, [syncActiveFromScroll]);

  // Restore the customer's place after a trip to the cart. Runs once the menu has
  // actually rendered, otherwise the container has no height to scroll within.
  useEffect(() => {
    if (isLoading || error) return;
    const container = scrollRef.current;
    if (!container || scrollTopRef.current === 0) return;
    container.scrollTop = scrollTopRef.current;
  }, [isLoading, error, layout, scrollTopRef]);


  // Keep the active chip visible — a rail you can't see the end of is useless
  useEffect(() => {
    if (layout !== 'scroll' || !activeCategoryId) return;
    chipRefs.current[activeCategoryId]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [layout, activeCategoryId]);

  /**
   * Handles for the in-flight jump. Held in a ref so a second tap cancels the
   * first: without this, jump A's release fired while jump B was still travelling
   * and un-guarded the scroll-spy mid-flight, making the rail chase the animation
   * — the exact thing the guard exists to prevent. Also stops a live 100ms
   * interval polling a detached node after unmount.
   */
  const jumpHandles = useRef<{ poll?: ReturnType<typeof setInterval>; failsafe?: ReturnType<typeof setTimeout> }>({});

  const clearJump = useCallback(() => {
    if (jumpHandles.current.poll) clearInterval(jumpHandles.current.poll);
    if (jumpHandles.current.failsafe) clearTimeout(jumpHandles.current.failsafe);
    jumpHandles.current = {};
  }, []);

  useEffect(() => clearJump, [clearJump]);

  const scrollTo = useCallback(
    (top: number, activeId: string | null) => {
      const container = scrollRef.current;
      if (!container) return;

      clearJump();
      isJumping.current = true;
      setActiveCategoryId(activeId);
      container.scrollTo({ top, behavior: 'smooth' });

      // A jump across 18 categories can be 10,000px+, so release the scroll-spy
      // when the scroll actually settles rather than after a guessed delay.
      jumpHandles.current.poll = setInterval(() => {
        if (Math.abs(container.scrollTop - top) < 4) {
          isJumping.current = false;
          clearJump();
        }
      }, 100);

      jumpHandles.current.failsafe = setTimeout(() => {
        isJumping.current = false;
        clearJump();
      }, 4000);
    },
    [clearJump]
  );

  const jumpToCategory = (categoryId: string) => {
    const section = sectionRefs.current[categoryId];
    const container = scrollRef.current;
    if (!section || !container) return;

    /*
     * Measured container-relative, NOT via offsetTop.
     *
     * offsetTop is relative to the nearest positioned ancestor, which is not the
     * scroller — so it included the whole header, while scrollTo() measures from
     * the container's own content box. Every jump overshot by roughly the header
     * height: the category heading landed above the fold and, on a short
     * category, the spy then highlighted the NEXT one, so the rail disagreed with
     * the screen. getBoundingClientRect is correct whatever happens to be
     * positioned, so a future layout change cannot silently reintroduce this.
     */
    const offsetWithinScroller =
      container.scrollTop +
      section.getBoundingClientRect().top -
      container.getBoundingClientRect().top;

    scrollTo(Math.max(0, offsetWithinScroller - 24), categoryId);
  };

  const scrollToTop = () => scrollTo(0, categories[0]?.id ?? null);

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
            {canChangeOrderType ? (
              <button
                type="button"
                onClick={onChangeOrderType}
                className="touchable focus-ring flex items-center gap-3 rounded-full border-2 border-cream-400 bg-white px-6 py-3"
              >
                {orderType === 'dine-in' ? (
                  <UtensilsCrossed className="h-8 w-8 text-brand-700" aria-hidden="true" />
                ) : (
                  <ShoppingBag className="h-8 w-8 text-brand-700" aria-hidden="true" />
                )}
                <span className="text-kiosk-xs font-bold text-ink-800">
                  {orderType === 'dine-in' ? 'Eat In' : 'Take Away'}
                </span>
                <span className="text-kiosk-xs font-bold text-brand-700">Change</span>
              </button>
            ) : (
              /* Derived, not hardcoded: the pill can then never disagree with the
                 order actually being placed, whatever forces orderType elsewhere. */
              <span className="flex items-center gap-3 rounded-full border-2 border-cream-400 bg-cream-200 px-6 py-3">
                {orderType === 'dine-in' ? (
                  <UtensilsCrossed className="h-8 w-8 text-ink-600" aria-hidden="true" />
                ) : (
                  <ShoppingBag className="h-8 w-8 text-ink-600" aria-hidden="true" />
                )}
                <span className="text-kiosk-xs font-bold text-ink-800">
                  {orderType === 'dine-in' ? 'Eat In' : 'Take Away'}
                </span>
              </span>
            )}

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
        <div className="-mx-12 mt-6 flex items-center gap-3 px-12">
          {/*
            "Top" sits in a FIXED slot beside the rail, not inside it.
            - Not floating over the grid: a round button pinned bottom-right sat
              on the right column's quick-add circle, so aiming for + jumped you
              to the top instead of adding the item.
            - Not prepended into the scroller either: that shifted every category
              chip sideways the moment it appeared, moving the rail under a finger
              already reaching for it.
            Rendered unconditionally rather than past a scroll threshold. At the
            top it is a harmless no-op, and always-present deletes the reserved
            hole, the hold-through-animation flag and every reflow-at-the-
            threshold problem in one go.
          */}
          <div className="w-[168px] shrink-0">
            <button
              type="button"
              onClick={scrollToTop}
              className="touchable focus-ring flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-ink-800 bg-ink-900 text-kiosk-xs font-extrabold text-white"
              style={{ minHeight: '76px' }}
            >
              <ArrowUp className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
              Top
            </button>
          </div>

          <div className="hide-scrollbar rail-fade -mr-12 flex-1 overflow-x-auto pr-12">
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
        </div>
        )}

        {/*
          Cards layout has no rail, so it gets its own strip. Always rendered for
          the same reason as the rail chip: a row that appears and disappears
          resized the shrink-0 header mid-scroll and shoved the whole grid down
          under a descending finger, which is how you open the wrong category.
        */}
        {layout === 'cards' && (
          <div className="mt-6 flex h-[76px] items-center justify-center">
            <button
              type="button"
              onClick={scrollToTop}
              className="touchable focus-ring flex h-full items-center gap-3 whitespace-nowrap rounded-full border-2 border-ink-800 bg-ink-900 px-10 text-kiosk-xs font-extrabold text-white"
            >
              <ArrowUp className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
              Back to top
            </button>
          </div>
        )}
      </header>

      {/* One continuous menu, divided by category */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 pb-10 pt-8">
        {error ? (
          <div className="card mx-auto mt-24 flex max-w-2xl flex-col items-center gap-8 p-14 text-center">
            <p className="text-kiosk-xl font-extrabold text-ink-900">We couldn&apos;t load the menu</p>
            {/* One fixed sentence for the customer. The raw throw ("Failed to
                fetch") was being rendered at 32px in a kebab shop; it is kept
                small and last, for staff. */}
            <p className="text-kiosk-base text-ink-700">
              Please try again, or order at the counter.
            </p>
            <button type="button" onClick={onReload} className="btn-primary text-kiosk-base">
              <RefreshCw className="h-8 w-8" aria-hidden="true" />
              Try again
            </button>
            <p className="text-kiosk-xs text-ink-500">{error}</p>
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
                  productCount={availableCount(productsByCategory(category.id))}
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
                className="pb-12 pt-4"
              >
                <div className="mb-6 flex items-baseline gap-5">
                  <h2 className="text-kiosk-xl font-extrabold text-ink-900">
                    {displayName(category.name)}
                  </h2>
                  {/* A fully sold-out category still shows its cards, but the count
                      must not read "0 items" above eight visible ones. */}
                  {availableCount(products) === 0 ? (
                    <span className="rounded-full bg-ink-900 px-5 py-2 text-kiosk-xs font-extrabold uppercase tracking-wide text-white">
                      All sold out today
                    </span>
                  ) : (
                    <span className="text-kiosk-xs font-semibold text-ink-600">
                      {availableCount(products)} item{availableCount(products) === 1 ? '' : 's'}
                    </span>
                  )}
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
                      onSoldOut={onSoldOut}
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
            <p className="w-full text-center text-kiosk-sm font-semibold text-ink-600">
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
          onSoldOut={onSoldOut}
          onViewOrder={onViewOrder}
          onClose={() => setOpenCategoryId(null)}
        />
      )}
    </div>
  );
}
