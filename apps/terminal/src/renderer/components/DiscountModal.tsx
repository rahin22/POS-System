import { useState } from 'react';

interface DiscountModalProps {
  subtotal: number;
  currencySymbol: string;
  onApplyPercentage: (percentage: number) => void;
  onApplyFixed: (amount: number) => void;
  onApplyCoupon: (code: string) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function DiscountModal({
  subtotal,
  currencySymbol,
  onApplyPercentage,
  onApplyFixed,
  onApplyCoupon,
  onCancel,
}: DiscountModalProps) {
  const [activeTab, setActiveTab] = useState<'percentage' | 'fixed' | 'coupon'>('percentage');
  const [percentageValue, setPercentageValue] = useState('');
  const [fixedValue, setFixedValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    setError('');
    setIsProcessing(true);

    try {
      if (activeTab === 'percentage') {
        const value = parseFloat(percentageValue);
        if (isNaN(value) || value <= 0 || value > 100) {
          setError('Please enter a valid percentage (1-100)');
          setIsProcessing(false);
          return;
        }
        onApplyPercentage(value);
        onCancel();
      } else if (activeTab === 'fixed') {
        const value = parseFloat(fixedValue);
        if (isNaN(value) || value <= 0 || value > subtotal) {
          setError(`Please enter a valid amount (${currencySymbol}0.01 - ${currencySymbol}${subtotal.toFixed(2)})`);
          setIsProcessing(false);
          return;
        }
        onApplyFixed(value);
        onCancel();
      } else {
        if (!couponCode.trim()) {
          setError('Please enter a coupon code');
          setIsProcessing(false);
          return;
        }
        const result = await onApplyCoupon(couponCode.trim());
        if (result.success) {
          onCancel();
        } else {
          setError(result.error || 'Invalid coupon code');
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPercentages = [5, 10, 15, 20, 25, 50];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Apply Discount</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('percentage')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'percentage'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            %
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'fixed'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {currencySymbol}
          </button>
          <button
            onClick={() => setActiveTab('coupon')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'coupon'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Coupon
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          {activeTab === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Percentage Discount
              </label>
              <input
                type="number"
                value={percentageValue}
                onChange={(e) => setPercentageValue(e.target.value)}
                placeholder="Enter percentage"
                min="0"
                max="100"
                step="1"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none"
              />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {quickPercentages.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setPercentageValue(pct.toString())}
                    className="py-2 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 font-medium"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'fixed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fixed Discount Amount
              </label>
              <input
                type="number"
                value={fixedValue}
                onChange={(e) => setFixedValue(e.target.value)}
                placeholder={`Enter amount in ${currencySymbol}`}
                min="0"
                max={subtotal}
                step="0.01"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none"
              />
              <p className="text-sm text-gray-500 mt-2">
                Subtotal: {currencySymbol}{subtotal.toFixed(2)}
              </p>
            </div>
          )}

          {activeTab === 'coupon' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coupon Code
              </label>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none uppercase"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={isProcessing}
            className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {isProcessing ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
