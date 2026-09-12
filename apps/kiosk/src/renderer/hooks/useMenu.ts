import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCategories, fetchProducts, fetchShopSettings } from '../lib/api';
import type { Category, Product, ShopSettings } from '../types';

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
 */
export function useMenu(apiUrl: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoading(true);
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

  // Menu edits from the POS should reach the kiosk without a restart
  useEffect(() => {
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

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
    reload: load,
    productsByCategory,
    highlights,
  };
}
