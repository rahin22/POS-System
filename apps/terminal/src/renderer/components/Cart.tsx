import { useState } from 'react';
import { Plus, Percent, FileText, X } from 'lucide-react';
import type { CartItem, Discount } from '../hooks/useCart';

interface CartProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountInfo: Discount | null;
  tax: number;
  total: number;
  vatRate: number;
  currencySymbol: string;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onEditItem?: (item: CartItem) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  onApplyDiscount?: () => void;
  onRemoveDiscount?: () => void;
  onAddCustomItem?: (name: string, price: number) => void;
  onAddComment?: () => void;
}

export function Cart({
  items,
  subtotal,
  discount,
  discountInfo,
  tax,
  total,
  vatRate,
  currencySymbol,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onClearCart,
  onCheckout,
  onApplyDiscount,
  onRemoveDiscount,
  onAddCustomItem,
  onAddComment,
}: CartProps) {
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  
  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  const handleAddCustomItem = () => {
    if (!customItemName.trim() || !customItemPrice || parseFloat(customItemPrice) <= 0) {
      alert('Please enter a valid name and price');
      return;
    }
    
    if (onAddCustomItem) {
      onAddCustomItem(customItemName.trim(), parseFloat(customItemPrice));
      setCustomItemName('');
      setCustomItemPrice('');
      setShowCustomItemModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Current Order</h2>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-b border-gray-200 grid grid-cols-4 gap-2">
        {onAddCustomItem && (
          <button
            onClick={() => setShowCustomItemModal(true)}
            className="flex flex-col items-center justify-center py-3 px-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-lg font-medium text-sm transition-colors"
          >
            <Plus className="w-6 h-6 mb-1" />
            <span>Add Item</span>
          </button>
        )}
        {onApplyDiscount && (
          <button
            onClick={onApplyDiscount}
            disabled={items.length === 0 || !!discountInfo}
            className="flex flex-col items-center justify-center py-3 px-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Percent className="w-6 h-6 mb-1" />
            <span>Discount</span>
          </button>
        )}
        {onAddComment && (
          <button
            onClick={onAddComment}
            className="flex flex-col items-center justify-center py-3 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm transition-colors"
          >
            <FileText className="w-6 h-6 mb-1" />
            <span>Comment</span>
          </button>
        )}
        <button
          onClick={onClearCart}
          disabled={items.length === 0}
          className="flex flex-col items-center justify-center py-3 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-6 h-6 mb-1" />
          <span>Clear</span>
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <span className="text-4xl block mb-2">🛒</span>
              <p>Cart is empty</p>
              <p className="text-sm">Tap products to add them</p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="cart-item">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.productName}</p>
                {item.modifiers.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {item.modifiers.map((m) => m.name).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs text-gray-400 italic">Note: {item.notes}</p>
                )}
                <p className="text-primary-600 font-medium">
                  {formatPrice(item.totalPrice)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold"
                >
                  +
                </button>
                {onEditItem && (
                  <button
                    onClick={() => onEditItem(item)}
                    className="w-10 h-10 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center ml-2 text-lg"
                    title="Edit item"
                  >
                    ✏️
                  </button>
                )}
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center ml-2"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-200 p-4 space-y-2 bg-gray-50">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        
        {/* Discount */}
        {discount > 0 && discountInfo && (
          <div className="flex justify-between items-center text-green-600">
            <span className="flex items-center gap-2">
              <span>Discount</span>
              {discountInfo.code && <span className="text-xs">({discountInfo.code})</span>}
            </span>
            <span className="flex items-center gap-2">
              <span>-{formatPrice(discount)}</span>
              {onRemoveDiscount && (
                <button
                  onClick={onRemoveDiscount}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xl font-bold"
                  aria-label="Remove discount"
                >
                  ×
                </button>
              )}
            </span>
          </div>
        )}
        
        <div className="flex justify-between text-gray-600">
          <span>GST ({vatRate}%)</span>
          <span>{formatPrice(tax)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-gray-800 pt-2 border-t border-gray-300">
          <span>Total</span>
          <span className="text-primary-600">{formatPrice(total)}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="pos-btn-success w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Checkout
        </button>
      </div>

      {/* Custom Item Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Custom Item</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name
                </label>
                <input
                  type="text"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  placeholder="Enter item name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCustomItemModal(false);
                  setCustomItemName('');
                  setCustomItemPrice('');
                }}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomItem}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
