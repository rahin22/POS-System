import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import type { Product, Category } from '@kebab-pos/shared';

interface ProductWithModifiers extends Product {
  modifierGroups?: Array<{
    id: string;
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  }>;
}

export function useProducts() {
  const { fetchApi } = useApi();
  const [products, setProducts] = useState<ProductWithModifiers[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        fetchApi<{ success: boolean; data: ProductWithModifiers[] }>('/api/products?available=true'),
        fetchApi<{ success: boolean; data: Category[] }>('/api/categories?active=true'),
      ]);

      if (productsRes.success) {
        setProducts(productsRes.data);
      }
      if (categoriesRes.success) {
        setCategories(categoriesRes.data);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const getProductsByCategory = useCallback((categoryId: string) => {
    return products.filter((p) => p.categoryId === categoryId);
  }, [products]);

  return {
    products,
    categories,
    isLoading,
    error,
    refresh: loadProducts,
    getProductsByCategory,
  };
}
