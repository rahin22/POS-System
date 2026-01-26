import React from 'react';

interface OrderConfirmationProps {
  orderNumber: number;
  onNewOrder: () => void;
}

export function OrderConfirmation({ orderNumber, onNewOrder }: OrderConfirmationProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        <div className="text-6xl mb-4">✅</div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Placed!</h1>

        <p className="text-gray-600 mb-6">Your order number is:</p>

        <div className="bg-primary-50 rounded-xl py-6 px-4 mb-6">
          <p className="text-5xl font-bold text-primary-600">#{orderNumber}</p>
        </div>

        <div className="space-y-3 text-sm text-gray-600 mb-8">
          <p>📱 We'll send you a text when your order is ready.</p>
          <p>🏪 Please pay when you collect your order.</p>
        </div>

        <button onClick={onNewOrder} className="btn-primary w-full">
          Place Another Order
        </button>
      </div>
    </div>
  );
}
