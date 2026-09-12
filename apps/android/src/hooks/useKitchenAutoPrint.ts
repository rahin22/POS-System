import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';
import { settings as platformSettings } from '../lib/platform';
import { printer } from '../lib/platform';

export const KITCHEN_AUTOPRINT_KEY = 'kitchenAutoPrint';
export const KITCHEN_DEVICE_KEY = 'kitchenDeviceName';

/** Orders placed without staff involvement; POS orders print at checkout already */
const SOURCES = 'kiosk,online';
const POLL_INTERVAL_MS = 20 * 1000;

interface QueuedOrder {
  id: string;
  orderNumber: number;
  type: string;
  customerName?: string | null;
  createdAt: string;
  source?: string;
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{
    quantity: number;
    unitPrice: number;
    notes?: string | null;
    product?: { name: string };
    modifiers?: Array<{ name: string; price: number }>;
  }>;
}

export interface KitchenPrintEvent {
  orderNumber: number;
  at: number;
  success: boolean;
  error?: string;
}

/**
 * Watches the backend for kiosk/online orders that still need a kitchen docket,
 * claims each one (so two devices can never print the same docket) and prints it
 * on the Sunmi's built-in printer.
 */
export function useKitchenAutoPrint() {
  const { fetchApi } = useApi();
  const [enabled, setEnabled] = useState(false);
  const [lastEvent, setLastEvent] = useState<KitchenPrintEvent | null>(null);
  const running = useRef(false);

  useEffect(() => {
    platformSettings.get<boolean>(KITCHEN_AUTOPRINT_KEY, false).then(setEnabled);
  }, []);

  const poll = useCallback(async () => {
    // One pass at a time: a slow printer must not stack up overlapping runs
    if (running.current) return;
    running.current = true;

    try {
      const response = await fetchApi<{ success: boolean; data: QueuedOrder[] }>(
        `/api/orders/kitchen/queue?sources=${SOURCES}`
      );

      if (!response.success) return;

      const device = await platformSettings.get<string>(KITCHEN_DEVICE_KEY, 'Sunmi T2s');

      for (const order of response.data) {
        // Claim first: whoever wins the claim owns the print
        const claim = await fetchApi<{ success: boolean; claimed: boolean; data?: QueuedOrder }>(
          `/api/orders/${order.id}/kitchen-print-claim`,
          { method: 'POST', body: JSON.stringify({ device }) }
        );

        if (!claim.success || !claim.claimed) continue;

        const full = claim.data || order;
        const result = await printer.printKitchenDocket({
          orderId: full.id,
          orderNumber: full.orderNumber,
          orderType: (full.type || 'takeaway').replace('_', '-') as any,
          customerName: full.customerName || undefined,
          items: (full.items || []).map((item) => ({
            name: item.product?.name || 'Unknown item',
            quantity: item.quantity || 1,
            price: item.unitPrice || 0,
            notes: item.notes || undefined,
            modifiers: (item.modifiers || []).map((modifier) => ({
              name: modifier.name,
              price: modifier.price || 0,
            })),
          })),
          subtotal: full.subtotal,
          gstAmount: full.tax,
          total: full.total,
          paymentMethod: 'kitchen',
          createdAt: full.createdAt,
        });

        if (!result.success) {
          // Hand the order back so it can be retried rather than lost
          await fetchApi(`/api/orders/${order.id}/kitchen-print-release`, { method: 'POST' }).catch(
            (err) => console.error('Failed to release kitchen print claim:', err)
          );
        }

        setLastEvent({
          orderNumber: full.orderNumber,
          at: Date.now(),
          success: result.success,
          error: result.error,
        });
      }
    } catch (err: any) {
      console.error('Kitchen auto-print poll failed:', err.message);
    } finally {
      running.current = false;
    }
  }, [fetchApi]);

  useEffect(() => {
    if (!enabled) return;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, poll]);

  const setAutoPrintEnabled = useCallback(async (next: boolean) => {
    setEnabled(next);
    await platformSettings.set(KITCHEN_AUTOPRINT_KEY, next);
  }, []);

  return { enabled, setAutoPrintEnabled, lastEvent, pollNow: poll };
}
