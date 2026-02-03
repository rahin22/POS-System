import { useState } from 'react';

interface CheckoutModalProps {
  total: number;
  currencySymbol: string;
  onConfirm: (
    orderType: 'dine-in' | 'takeaway',
    paymentMethod: 'cash' | 'card',
    customerInfo?: { name?: string; phone?: string }
  ) => Promise<{ success: boolean; orderNumber?: number; error?: string }>;
  onCancel: () => void;
}

export function CheckoutModal({ total, currencySymbol, onConfirm, onCancel }: CheckoutModalProps) {
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('takeaway');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [orderComplete, setOrderComplete] = useState<number | null>(null);

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError('');

    const result = await onConfirm(orderType, paymentMethod, {
      name: customerName || undefined,
    });

    if (result.success) {
      setOrderComplete(result.orderNumber!);
    } else {
      setError(result.error || 'Failed to process order');
    }

    setIsProcessing(false);
  };

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  // Order complete screen
  if (orderComplete !== null) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Complete!</h2>
          <p className="text-4xl font-bold text-primary-600 mb-6">#{orderComplete}</p>
          <p className="text-gray-600 mb-6">Receipt is printing...</p>
          <button
            onClick={onCancel}
            className="pos-btn-primary w-full text-lg"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Checkout</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Total */}
        <div className="text-center mb-6 py-4 bg-gray-50 rounded-xl">
          <p className="text-gray-600 mb-1">Total Amount</p>
          <p className="text-4xl font-bold text-primary-600">{formatPrice(total)}</p>
        </div>

        {/* Order Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Order Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOrderType('takeaway')}
              className={`p-4 rounded-xl border-2 font-medium transition-all ${
                orderType === 'takeaway'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              🥡 Takeaway
            </button>
            <button
              onClick={() => setOrderType('dine-in')}
              className={`p-4 rounded-xl border-2 font-medium transition-all ${
                orderType === 'dine-in'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              🍽️ Dine In
            </button>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-4 rounded-xl border-2 font-medium transition-all ${
                paymentMethod === 'cash'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              💵 Cash
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`p-4 rounded-xl border-2 font-medium transition-all ${
                paymentMethod === 'card'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              💳 Card
            </button>
          </div>
        </div>

        {/* Customer Name (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Name (optional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            placeholder="For order pickup"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="pos-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="pos-btn-success flex-1 text-lg"
          >
            {isProcessing ? 'Processing...' : 'Confirm Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
