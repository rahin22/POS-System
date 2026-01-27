import NodeCache from 'node-cache';

// Cache with 5 minute TTL for most items
export const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance - don't clone objects
});

// Cache keys
export const CACHE_KEYS = {
  PRODUCTS: 'products',
  PRODUCTS_WITH_MODIFIERS: 'products_with_modifiers',
  CATEGORIES: 'categories',
  MODIFIERS: 'modifiers',
  MODIFIER_GROUPS: 'modifier_groups',
  SETTINGS: 'settings',
};

// Helper to invalidate product-related caches
export const invalidateProductCache = () => {
  cache.del(CACHE_KEYS.PRODUCTS);
  cache.del(CACHE_KEYS.PRODUCTS_WITH_MODIFIERS);
};

// Helper to invalidate all caches (use sparingly)
export const invalidateAllCache = () => {
  cache.flushAll();
};

// Wrapper for cached queries
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    console.log(`[CACHE HIT] ${key}`);
    return cached;
  }

  // Execute query and cache result
  console.log(`[CACHE MISS] ${key}`);
  const result = await queryFn();
  if (ttl) {
    cache.set(key, result, ttl);
  } else {
    cache.set(key, result);
  }
  return result;
}
