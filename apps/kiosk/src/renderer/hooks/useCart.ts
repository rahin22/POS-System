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

  return { lines, addLine, replaceLine, setQuantity, removeLine, clear, ...totals };
}

export type Cart = ReturnType<typeof useCart>;
