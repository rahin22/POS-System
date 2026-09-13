import { useCallback, useMemo, useState } from 'react';
import type { CartLine, Modifier, Product } from '../types';

let lineCounter = 0;

export function useCart(vatRate: number) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addLine = useCallback((product: Product, quantity: number, modifiers: Modifier[]) => {
    const unitPrice = product.price + modifiers.reduce((sum, m) => sum + m.price, 0);

    setLines((prev) => {
      // Fold into an existing line only when the options match exactly
      const signature = modifiers.map((m) => m.id).sort().join('|');
      const existing = prev.find(
        (line) =>
          line.product.id === product.id &&
          line.modifiers.map((m) => m.id).sort().join('|') === signature
      );

      if (existing) {
        return prev.map((line) =>
          line.lineId === existing.lineId
            ? { ...line, quantity: line.quantity + quantity }
            : line
        );
      }

      lineCounter += 1;
      return [
        ...prev,
        { lineId: `line-${Date.now()}-${lineCounter}`, product, quantity, modifiers, unitPrice },
      ];
    });
  }, []);

  /** Applies edits made in the item sheet to an existing line */
  const replaceLine = useCallback((lineId: string, quantity: number, modifiers: Modifier[]) => {
    setLines((prev) =>
      prev.map((line) =>
        line.lineId === lineId
          ? {
              ...line,
              quantity,
              modifiers,
              unitPrice: line.product.price + modifiers.reduce((sum, m) => sum + m.price, 0),
            }
          : line
      )
    );
  }, []);

  /**
   * Swaps a line onto its combo product, keeping the quantity and the chosen options.
   *
   * Options are carried over WHOLE, not filtered. findComboOffers has already
   * established that the combo carries every modifier on this line - an upgrade
   * that would drop one is never offered - so filtering here could only ever
   * silently discard something the customer chose and confirmed, while the sheet
   * quoted a price that assumed otherwise.
   *
   * The earlier version filtered on the belief that a foreign modifier id "would be
   * rejected by the backend". It would not: orders.ts looks modifiers up by id with
   * no product-membership check, so the id is accepted and priced. The safety has to
   * live in the offer, and it does.
   */
  const upgradeLine = useCallback((lineId: string, product: Product) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;

        return {
          ...line,
          product,
          unitPrice: product.price + line.modifiers.reduce((sum, m) => sum + m.price, 0),
        };
      })
    );
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.lineId !== lineId)
        : prev.map((line) => (line.lineId === lineId ? { ...line, quantity } : line))
    );
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((line) => line.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo(() => {
    const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    // Prices are GST-inclusive, matching the POS: extract the tax component
    const tax = total - total / (1 + vatRate / 100);
    return {
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: total,
      tax,
      total,
    };
  }, [lines, vatRate]);

  return { lines, addLine, replaceLine, upgradeLine, setQuantity, removeLine, clear, ...totals };
}

export type Cart = ReturnType<typeof useCart>;
