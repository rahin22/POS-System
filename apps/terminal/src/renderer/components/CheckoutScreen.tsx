import { useState } from 'react';
import { CartItem } from '../hooks/useCart';

interface CheckoutScreenProps {
  items: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  currencySymbol: string;
  onConfirm: (
    orderType: 'dine-in' | 'takeaway',
    payments: Array<{ method: 'cash' | 'card'; amount: number }>,
    customerInfo?: { name?: string; phone?: string },
    printReceipt?: boolean
  ) => Promise<{ success: boolean; orderNumber?: number; error?: string }>;
  onCancel: () => void;
}

export function CheckoutScreen({
  items,
  total,
  subtotal,
  tax,
  discount,
  currencySymbol,
  onConfirm,
  onCancel,
}: CheckoutScreenProps) {
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('takeaway');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Payment state
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [orderComplete, setOrderComplete] = useState<{ orderNumber: number; change: number } | null>(null);

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  // Quick cash buttons for Australian denominations
  const quickCashButtons = [5, 10, 20, 50, 100];

  const handleQuickCash = (amount: number) => {
    const currentCash = parseFloat(cashAmount) || 0;
    const newCash = currentCash + amount;
    setCashAmount(newCash.toString());
    
    // In split mode, auto-fill card with remaining
    if (paymentMode === 'split') {
      const remaining = Math.max(0, total - newCash);
      setCardAmount(remaining > 0 ? remaining.toFixed(2) : '');
    }
  };

  const handleCashChange = (value: string) => {
    setCashAmount(value);
    
    // In split mode, auto-fill card with remaining
    if (paymentMode === 'split') {
      const cash = parseFloat(value) || 0;
      const remaining = Math.max(0, total - cash);
      setCardAmount(remaining > 0 ? remaining.toFixed(2) : '');
    }
  };

  const handlePayExact = () => {
    if (paymentMode === 'cash') {
      setCashAmount(total.toFixed(2));
    } else if (paymentMode === 'card') {
      setCardAmount(total.toFixed(2));
    }
  };

  const calculateChange = () => {
    if (paymentMode === 'cash') {
      const cash = parseFloat(cashAmount) || 0;
      return Math.max(0, cash - total);
    } else if (paymentMode === 'split') {
      const cash = parseFloat(cashAmount) || 0;
      const card = parseFloat(cardAmount) || 0;
      const totalPaid = cash + card;
      return Math.max(0, totalPaid - total);
    }
    return 0;
  };

  const getTotalPaid = () => {
    if (paymentMode === 'cash') {
      return parseFloat(cashAmount) || 0;
    } else if (paymentMode === 'card') {
      return parseFloat(cardAmount) || 0;
    } else {
      return (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0);
    }
  };

  const isPaymentValid = () => {
    const paid = getTotalPaid();
    return paid >= total;
  };

  const handleCompleteOrder = async () => {
    if (!isPaymentValid()) {
      setError('Payment amount is insufficient');
      return;
    }

    setIsProcessing(true);
    setError('');

    const payments: Array<{ method: 'cash' | 'card'; amount: number }> = [];
    
    if (paymentMode === 'cash') {
      payments.push({ method: 'cash', amount: total });
    } else if (paymentMode === 'card') {
      payments.push({ method: 'card', amount: total });
    } else {
      const cash = parseFloat(cashAmount) || 0;
      const card = parseFloat(cardAmount) || 0;
      if (cash > 0) payments.push({ method: 'cash', amount: cash });
      if (card > 0) payments.push({ method: 'card', amount: card });
    }

    const result = await onConfirm(
      orderType,
      payments,
      {
        name: customerName || undefined,
        phone: customerPhone || undefined,
      },
      true // Always print receipt
    );

    if (result.success) {
      setOrderComplete({
        orderNumber: result.orderNumber!,
        change: calculateChange()
      });
    } else {
      setError(result.error || 'Failed to process order');
    }

    setIsProcessing(false);
  };

  // Order complete screen
  if (orderComplete) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">✅</div>
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Order Complete!</h2>
          <p className="text-6xl font-bold text-primary-600 mb-8">#{orderComplete.orderNumber}</p>
          <p className="text-xl text-gray-600 mb-4">Receipt is printing...</p>
          {orderComplete.change > 0 && (
            <div className="bg-green-50 border-2 border-green-500 rounded-xl p-6 mb-8">
              <p className="text-gray-700 text-lg mb-2">Change Due</p>
              <p className="text-5xl font-bold text-green-600">{formatPrice(orderComplete.change)}</p>
            </div>
          )}
          <button
            onClick={onCancel}
            className="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold text-xl"
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="w-12 h-12 rounded-lg hover:bg-primary-700 flex items-center justify-center text-2xl"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {error && (
        <div className="bg-red-50 border-b-2 border-red-500 text-red-700 px-6 py-4 text-center font-medium">
          {error}
        </div>
      )}

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Order Summary */}
        <div className="w-1/2 border-r-2 border-gray-200 flex flex-col bg-gray-50">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
            
            {/* Order Type */}
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`p-3 rounded-lg border-2 font-medium transition-all ${
                    orderType === 'takeaway'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-primary-400'
                  }`}
                >
                  Takeaway
                </button>
                <button
                  onClick={() => setOrderType('dine-in')}
                  className={`p-3 rounded-lg border-2 font-medium transition-all ${
                    orderType === 'dine-in'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:border-primary-400'
                  }`}
                >
                  Dine In
                </button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none"
                placeholder="Customer name (optional)"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none"
                placeholder="Phone (optional)"
              />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto px-6">
            <h3 className="font-semibold text-gray-700 mb-3">Items</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">
                        {item.quantity}× {item.productName}
                      </p>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {item.modifiers.map((m) => m.name).join(', ')}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-400 italic">{item.notes}</p>
                      )}
                    </div>
                    <p className="font-semibold text-gray-800 ml-2">
                      {formatPrice(item.totalPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-gray-200 bg-white p-6">
            <div className="space-y-2 text-lg">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (10%)</span>
                <span>{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-2xl text-primary-600 pt-2 border-t-2">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Payment */}
        <div className="w-1/2 flex flex-col p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Payment</h2>

          {/* Payment Method Selection */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setPaymentMode('cash');
                setCashAmount(total.toFixed(2));
                setCardAmount('');
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-lg transition-all ${
                paymentMode === 'cash'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => {
                setPaymentMode('card');
                setCardAmount(total.toFixed(2));
                setCashAmount('');
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-lg transition-all ${
                paymentMode === 'card'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
               Card
            </button>
            <button
              onClick={() => {
                setPaymentMode('split');
                setCashAmount('');
                setCardAmount('');
              }}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-lg transition-all ${
                paymentMode === 'split'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Split Payment
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Cash Payment */}
            {(paymentMode === 'cash' || paymentMode === 'split') && (
              <div className="mb-6">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  {paymentMode === 'split' ? 'Cash Amount' : 'Amount Tendered'}
                </label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => handleCashChange(e.target.value)}
                  className="w-full px-4 py-4 text-2xl border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none text-center font-bold"
                  placeholder="0.00"
                  step="0.01"
                />

                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {quickCashButtons.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleQuickCash(amount)}
                      className="py-3 bg-green-100 hover:bg-green-200 border-2 border-green-500 rounded-lg font-bold text-lg"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                {paymentMode === 'cash' && (
                  <button
                    onClick={handlePayExact}
                    className="w-full mt-2 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold"
                  >
                    Exact ({formatPrice(total)})
                  </button>
                )}
              </div>
            )}

            {/* Card Payment */}
            {(paymentMode === 'card' || paymentMode === 'split') && (
              <div className="mb-6">
                <label className="block text-lg font-semibold text-gray-700 mb-3">Card Amount</label>
                <input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  className="w-full px-4 py-4 text-2xl border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none text-center font-bold"
                  placeholder="0.00"
                  step="0.01"
                />

                {paymentMode === 'card' && (
                  <button
                    onClick={handlePayExact}
                    className="w-full mt-2 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold"
                  >
                    Full Amount ({formatPrice(total)})
                  </button>
                )}
              </div>
            )}

            {/* Payment Summary */}
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-lg">
                  <span className="font-medium">Total Due:</span>
                  <span className="font-bold text-primary-600">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-medium">Tendered:</span>
                  <span className="font-bold">{formatPrice(getTotalPaid())}</span>
                </div>
                {calculateChange() > 0 && (
                  <div className="flex justify-between text-lg pt-2 border-t-2 border-gray-300">
                    <span className="font-medium">Change:</span>
                    <span className="font-bold text-green-600">{formatPrice(calculateChange())}</span>
                  </div>
                )}
                {getTotalPaid() < total && (
                  <div className="flex justify-between text-lg text-red-600 pt-2 border-t-2 border-gray-300">
                    <span className="font-medium">Remaining:</span>
                    <span className="font-bold">{formatPrice(total - getTotalPaid())}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Complete Order Button */}
          <button
            onClick={handleCompleteOrder}
            disabled={!isPaymentValid() || isProcessing}
            className="w-full mt-6 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Complete Order & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
