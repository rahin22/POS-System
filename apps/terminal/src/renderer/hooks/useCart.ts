import { useState, useCallback, useEffect, useRef } from 'react';
import { useApi } from '../context/ApiContext';

// VFD update helper
const updateVFD = async (action: 'itemAdded' | 'total' | 'welcome', data?: { itemName?: string; price?: number; total?: number }) => {
  if (!window.electronAPI?.vfd) return;
  try {
    if (action === 'itemAdded' && data?.itemName && data?.price !== undefined && data?.total !== undefined) {
      await window.electronAPI.vfd.itemAdded(data.itemName, data.price, data.total);
    } else if (action === 'total' && data?.total !== undefined) {
      await window.electronAPI.vfd.total(data.total);
    } else if (action === 'welcome') {
      await window.electronAPI.vfd.welcome();
    }
  } catch (e) {
    // Silently fail if VFD not available
  }
};

export interface CartItem {
  id: string; // Unique cart item ID
  productId: string;
  productName: string;
  basePrice: number; // Product base price without modifiers
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  modifiers: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface Discount {
  type: 'percentage' | 'fixed' | 'coupon';
  value: number; // Percentage or fixed amount
  amount: number; // Calculated discount amount
  code?: string; // Coupon code if applicable
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function useCart(vatRate: number = 10) {
  const { fetchApi } = useApi();
  const [items, setItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<Discount | null>(null);

  const calculateTotals = useCallback((cartItems: CartItem[], discountInfo: Discount | null) => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    let discountAmount = 0;
    if (discountInfo) {
      if (discountInfo.type === 'percentage') {
        discountAmount = subtotal * (discountInfo.value / 100);
      } else {
        discountAmount = discountInfo.value;
      }
      // Don't let discount exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal);
    }
    
    const afterDiscount = subtotal - discountAmount;
    const tax = afterDiscount * (vatRate / 100);
    const total = afterDiscount + tax;
    
    return { subtotal, discount: discountAmount, tax, total };
  }, [vatRate]);

  // Track last added item for VFD display
  const lastAddedItemRef = useRef<{ name: string; price: number } | null>(null);

  // Update VFD when cart items change
  useEffect(() => {
    const totals = calculateTotals(items, discount);
    if (items.length === 0) {
      updateVFD('welcome');
      lastAddedItemRef.current = null;
    } else if (lastAddedItemRef.current) {
      // Show item that was just added with running total
      updateVFD('itemAdded', {
        itemName: lastAddedItemRef.current.name,
        price: lastAddedItemRef.current.price,
        total: totals.total,
      });
      lastAddedItemRef.current = null;
    } else {
      // Just show total (for quantity changes, removals, etc.)
      updateVFD('total', { total: totals.total });
    }
  }, [items, discount, calculateTotals]);

  const addItem = useCallback((
    product: { id: string; name: string; price: number },
    quantity: number = 1,
    modifiers: Array<{ id: string; name: string; price: number }> = [],
    notes?: string
  ) => {
    const modifierTotal = modifiers.reduce((sum, m) => sum + m.price, 0);
    const unitPrice = product.price + modifierTotal;
    const totalPrice = unitPrice * quantity;

    // Store item info for VFD display
    lastAddedItemRef.current = { name: product.name, price: totalPrice };

    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}`, // Unique ID for this cart entry
      productId: product.id,
      productName: product.name,
      basePrice: product.price,
      quantity,
      unitPrice,
      totalPrice,
      notes,
      modifiers,
    };

    setItems((prev) => [...prev, newItem]);
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, quantity, totalPrice: item.unitPrice * quantity }
            : item
        )
      );
    }
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const updateItem = useCallback((
    itemId: string,
    modifiers: Array<{ id: string; name: string; price: number }>,
    notes: string
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        
        const modifiersTotal = modifiers.reduce((sum, mod) => sum + mod.price, 0);
        const unitPrice = item.basePrice + modifiersTotal;
        const totalPrice = unitPrice * item.quantity;
        
        return {
          ...item,
          modifiers,
          notes,
          unitPrice,
          totalPrice
        };
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscount(null);
    // VFD will show welcome via the useEffect
  }, []);

  const applyDiscount = useCallback((type: 'percentage' | 'fixed', value: number) => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    let amount = 0;
    
    if (type === 'percentage') {
      amount = subtotal * (value / 100);
    } else {
      amount = value;
    }
    
    setDiscount({ type, value, amount: Math.min(amount, subtotal) });
  }, [items]);

  const applyCoupon = useCallback(async (code: string) => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    try {
      const response = await fetchApi<{ success: boolean; data: any; error?: string }>(
        '/api/coupons/validate',
        {
          method: 'POST',
          body: JSON.stringify({ code, orderTotal: subtotal }),
        }
      );

      if (response.success) {
        const coupon = response.data;
        let amount = 0;
        
        if (coupon.type === 'percentage') {
          amount = subtotal * (coupon.value / 100);
          if (coupon.maxDiscount) {
            amount = Math.min(amount, coupon.maxDiscount);
          }
        } else {
          amount = coupon.value;
        }
        
        setDiscount({
          type: 'coupon',
          value: coupon.value,
          amount: Math.min(amount, subtotal),
          code: code,
        });
        
        return { success: true };
      } else {
        return { success: false, error: response.error };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to validate coupon' };
    }
  }, [items, fetchApi]);

  const removeDiscount = useCallback(() => {
    setDiscount(null);
  }, []);

  const submitOrder = useCallback(async (
    orderType: 'dine-in' | 'takeaway' | 'delivery' | 'online',
    customerInfo?: { name?: string; phone?: string; email?: string },
    notes?: string
  ) => {
    const orderItems = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
      modifierIds: item.modifiers.map((m) => m.id),
    }));

    const response = await fetchApi<{ success: boolean; data: any; error?: string }>(
      '/api/orders',
      {
        method: 'POST',
        body: JSON.stringify({
          type: orderType,
          items: orderItems,
          customerName: customerInfo?.name,
          customerPhone: customerInfo?.phone,
          customerEmail: customerInfo?.email,
          notes,
          discount: discount ? {
            type: discount.type,
            value: discount.value,
            amount: discount.amount,
            code: discount.code,
          } : undefined,
        }),
      }
    );

    if (response.success) {
      clearCart();
    }

    return response;
  }, [items, discount, fetchApi, clearCart]);

  const totals = calculateTotals(items, discount);

  return {
    items,
    ...totals,
    discountInfo: discount,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    addItem,
    updateItemQuantity,
    updateItem,
    removeItem,
    clearCart,
    applyDiscount,
    applyCoupon,
    removeDiscount,
    submitOrder,
  };
}
