import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCategories, fetchProducts, fetchShopSettings } from '../lib/api';
import type { Category, Product, ShopSettings } from '../types';

/** Floor between refreshes, so a rush of short orders cannot hammer the API */
const MIN_REFRESH_GAP_MS = 60 * 1000;

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: 'Al Taher Kebabs',
  address: '',
  phone: '',
  vatRate: 10,
  currencySymbol: '$',
};

/**
 * @param apiUrl null until the kiosk settings have been read from the main
 *        process. Loading before then would hit the wrong origin.
 * @param paused true while a customer is mid-order. Two reasons, and the second
 *        is the important one:
 *        1. A refresh flipped isLoading, which swapped the menu the customer was
 *           reading for loading skeletons.
 *        2. A refresh can remove or sell out a product that is already in the
 *           basket. The order is only created AFTER the card is charged, so a
 *           product that vanished mid-order means the backend rejects the order
 *           with money already taken. Not refreshing during an order removes the
 *           whole class of problem.
 */
export function useMenu(apiUrl: string | null, paused = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastLoadedAt = useRef(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!apiUrl) return;

    // Stamped BEFORE the await, not in the finally: the initial load and the
    // paused-edge refresh both run when apiUrl arrives, and a finally-stamp left
    // both seeing 0, firing two concurrent full loads that race to write
    // products/error. If the loser failed transiently it set error, which flips
    // kioskStatus to 'unavailable' and closes a kiosk holding a good menu.
    lastLoadedAt.current = Date.now();

    // A background refresh must not put the menu behind skeletons; only a first
    // load or an explicit retry shows the loading state.
    if (!options?.silent) setIsLoading(true);
    try {
      const [productsData, categoriesData, settingsData] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchShopSettings().catch(() => DEFAULT_SETTINGS),
      ]);

      setProducts(productsData);
      // Only show categories that actually have something in them
      setCategories(
        categoriesData.filter((category) =>
          productsData.some((product) => product.categoryId === category.id)
        )
      );
      setShop({ ...DEFAULT_SETTINGS, ...settingsData });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load the menu');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Menu edits from the POS reach the kiosk without a restart, but only between
   * customers.
   *
   * The interval ALONE is not enough: it is torn down and recreated on every
   * order, so on a busy night - a customer every three minutes - a five minute
   * timer never once completes and the menu stays frozen at whatever it was when
   * the app booted. Staff mark the lamb out at 8pm, the kiosk keeps selling it at
   * 8:40, and the docket reaches a kitchen that has none.
   *
   * So the refresh is driven by the paused -> false EDGE, which is the moment a
   * customer finishes, with a floor between calls so back-to-back customers do
   * not hammer the API. The interval then only covers a kiosk standing idle.
   */
  useEffect(() => {
    if (paused) return;

    const sinceLast = Date.now() - lastLoadedAt.current;
    if (sinceLast >= MIN_REFRESH_GAP_MS) {
      load({ silent: true });
    }

    const interval = setInterval(() => load({ silent: true }), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load, paused]);

  // Stable identity, so a future useEffect([reload]) cannot loop
  const reload = useCallback(() => load(), [load]);

  const productsByCategory = useCallback(
    (categoryId: string) =>
      products
        .filter((product) => product.categoryId === categoryId)
        // Staff ordering first (so Small/Medium/Large read correctly), sold-out last
        .sort((a, b) => {
          if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.price - b.price;
        }),
    [products]
  );

  /** Items shown on the attract screen: photographed ones first, then dearer ones */
  const highlights = useMemo(() => {
    const available = products.filter((product) => product.isAvailable);
    const withImages = available.filter((product) => product.imageUrl || product.image);
    const pool = withImages.length >= 3 ? withImages : available;
    return [...pool].sort((a, b) => b.price - a.price).slice(0, 5);
  }, [products]);

  return {
    products,
    categories,
    shop,
    isLoading,
    error,
    /** Manual retry: shows the loading state, unlike the background poll */
    reload,
    productsByCategory,
    highlights,
  };
}
