import type { Category, PlacedOrder, Product, ShopSettings, CartLine, OrderType } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

let baseUrl = '';

export function setApiBaseUrl(url: string) {
  baseUrl = url.replace(/\/$/, '');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success) {
    throw new Error(json.error || `Request failed (${response.status})`);
  }

  return json.data;
}

/**
 * Is the backend answering RIGHT NOW?
 *
 * Called immediately before the card terminal is armed. The attract screen's
 * status gate only closes the entrance: a customer already mid-order when the
 * backend dies still reaches Pay, and because the order is created only AFTER the
 * card is approved, the failure lands as money taken with no order.
 *
 * This does not prove a POST will succeed - only a POST proves that - but it
 * catches the dominant failure by far, which is the backend or the network being
 * down, and it costs one cheap GET on a path the customer is already waiting on.
 *
 * Deliberately short-timed: a customer standing at a terminal will not wait, and
 * a backend too slow to answer this is too slow to create an order before the
 * terminal times out anyway.
 */
export async function isBackendReachable(timeoutMs = 4000): Promise<boolean> {
  if ((window as any).__KIOSK_PREVIEW__) return true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/settings`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches everything, including unavailable items, so the kiosk can show a
 * "Sold out" card rather than silently dropping a product a customer came for.
 */
export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>('/api/products');
}

export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>('/api/categories?active=true');
}

export function fetchShopSettings(): Promise<ShopSettings> {
  return request<ShopSettings>('/api/settings');
}

/**
 * Creates the order already marked as paid. The kiosk only calls this once the
 * card payment has been accepted, so an order never exists unpaid.
 *
 * In browser-preview mode (no Electron bridge) this is a dry run: design review
 * and UI work must never write real orders into the shop's database.
 */
export async function createPaidOrder(params: {
  type: OrderType;
  lines: CartLine[];
}): Promise<PlacedOrder> {
  if ((window as any).__KIOSK_PREVIEW__) {
    console.warn('[kiosk] preview mode — order NOT sent to the backend');
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      id: 'preview-order',
      orderNumber: 42,
      total: params.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
      createdAt: new Date().toISOString(),
    };
  }

  return request<PlacedOrder>('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      type: params.type,
      source: 'kiosk',
      paymentMethod: 'card',
      paymentStatus: 'paid',
      items: params.lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        modifierIds: line.modifiers.map((m) => m.id),
      })),
    }),
  });
}
