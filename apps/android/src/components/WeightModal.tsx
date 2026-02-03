import { useState } from 'react';
import { Scale, Hash, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  pricePerKg?: number | null;
}

interface WeightModalProps {
  product: Product;
  currencySymbol: string;
  onAddByQuantity: (quantity: number) => void;
  onAddByWeight: (weightKg: number) => void;
  onClose: () => void;
}

export function WeightModal({ product, currencySymbol, onAddByQuantity, onAddByWeight, onClose }: WeightModalProps) {
  const [mode, setMode] = useState<'quantity' | 'weight'>('quantity');
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState('');

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  const handleSubmit = () => {
    if (mode === 'quantity') {
      if (quantity > 0) {
        onAddByQuantity(quantity);
      }
    } else {
      const weightKg = parseFloat(weight);
      if (weightKg > 0) {
        onAddByWeight(weightKg);
      }
    }
  };

  const calculateTotal = () => {
    if (mode === 'quantity') {
      return product.price * quantity;
    } else {
      const weightKg = parseFloat(weight) || 0;
      return (product.pricePerKg || 0) * weightKg;
    }
  };

  // Quick weight buttons (common weights)
  const quickWeights = [0.25, 0.5, 0.75, 1, 1.5, 2];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('quantity')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                mode === 'quantity'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Hash className="w-5 h-5" />
              <span>By Quantity</span>
            </button>
            <button
              onClick={() => setMode('weight')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                mode === 'weight'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Scale className="w-5 h-5" />
              <span>By Weight (kg)</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {mode === 'quantity' ? (
            <div>
              <div className="text-center mb-4">
                <span className="text-2xl font-bold text-primary-600">{formatPrice(product.price)}</span>
                <span className="text-gray-500 ml-1">each</span>
              </div>
              
              {/* Quantity selector */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-14 h-14 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-700 transition-colors"
                >
                  -
                </button>
                <span className="text-4xl font-bold text-gray-900 w-20 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-2xl font-bold text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-4">
                <span className="text-2xl font-bold text-primary-600">{formatPrice(product.pricePerKg || 0)}</span>
                <span className="text-gray-500 ml-1">per kg</span>
              </div>
              
              {/* Weight input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter weight (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.000"
                  className="w-full px-4 py-3 text-2xl text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>

              {/* Quick weight buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {quickWeights.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeight(w.toString())}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
                  >
                    {w} kg
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total:</span>
              <span className="text-2xl font-bold text-primary-600">{formatPrice(calculateTotal())}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={mode === 'weight' && (!weight || parseFloat(weight) <= 0)}
              className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
