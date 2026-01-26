import React from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartProps {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  vatRate: number;
  currencySymbol: string;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onClose: () => void;
}

export function Cart({
  items,
  subtotal,
  tax,
  total,
  vatRate,
  currencySymbol,
  onUpdateQuantity,
  onClearCart,
  onCheckout,
  onClose,
}: CartProps) {
  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Cart Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Your Order</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="text-4xl mb-2">🛒</p>
              <p>Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-primary-600 text-sm">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={onClearCart}
                className="text-red-500 hover:text-red-600 text-sm mt-4"
              >
                Clear Cart
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>VAT ({vatRate}%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary-600">{formatPrice(total)}</span>
              </div>
            </div>

            <button onClick={onCheckout} className="btn-primary w-full">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
