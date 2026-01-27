import { useState, useEffect } from 'react';
import { ProductGrid } from './ProductGrid';
import { Cart } from './Cart';
import { CategoryTabs } from './CategoryTabs';
import { CheckoutScreen } from './CheckoutScreen';
import { DiscountModal } from './DiscountModal';
import ItemEditModal from './ItemEditModal';
import { useProducts } from '../hooks/useProducts';
import { useCart, CartItem } from '../hooks/useCart';
import { useApi } from '../context/ApiContext';

export function POSLayout() {
  const { fetchApi } = useApi();
  const { products, categories, isLoading, error, getProductsByCategory } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [orderComment, setOrderComment] = useState('');
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [vatRate, setVatRate] = useState(10);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const cart = useCart(vatRate);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetchApi<{ success: boolean; data: any }>('/api/settings');
        if (response.success) {
          setVatRate(response.data.vatRate || 20);
          setCurrencySymbol(response.data.currencySymbol || '£');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
  }, [fetchApi]);

  // Set first category as selected
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const displayedProducts = selectedCategory
    ? getProductsByCategory(selectedCategory)
    : products;

  const handleAddCustomItem = (name: string, price: number) => {
    cart.addItem(
      {
        id: `custom-${Date.now()}`,
        name: name,
        price: price,
      },
      1,
      [],
      undefined
    );
  };

  const handleProductClick = (product: any) => {
    // For simplicity, add directly. Could show modifier modal here.
    cart.addItem(
      { id: product.id, name: product.name, price: product.price },
      1,
      [],
      undefined
    );
  };

  const handleCheckout = async (
    orderType: 'dine-in' | 'takeaway',
    payments: Array<{ method: 'cash' | 'card'; amount: number }>,
    customerInfo?: { name?: string; phone?: string },
    printReceipt?: boolean
  ) => {
    try {
      const response = await cart.submitOrder(orderType, customerInfo);
      
      if (response.success) {
        // Determine primary payment method (highest amount)
        const primaryPayment = payments.reduce((prev, curr) => 
          curr.amount > prev.amount ? curr : prev
        );
        
        // Update payment status
        await fetchApi(`/api/orders/${response.data.id}/payment`, {
          method: 'PATCH',
          body: JSON.stringify({
            paymentMethod: primaryPayment.method,
            paymentStatus: 'paid',
          }),
        });

        // Print receipt if requested (locally via Electron IPC)
        if (printReceipt && response.data) {
          console.log('Print requested, printReceipt:', printReceipt);
          if (window.electronAPI?.printReceipt) {
            console.log('Calling Electron print API with data:', response.data);
            
            // Get order type - API returns 'type' with underscore format (dine_in), convert to display format
            const orderType = (response.data.type || 'takeaway').replace('_', '-');
            
            // Print customer receipt
            const printResult = await window.electronAPI.printReceipt({
              orderId: response.data.id,
              orderNumber: response.data.orderNumber,
              customerName: response.data.customerName,
              orderType: orderType,
              items: response.data.items,
              subtotal: response.data.subtotal,
              tax: response.data.tax,
              total: response.data.total,
              paymentMethod: primaryPayment.method,
            });
            console.log('Customer receipt print result:', printResult);
            
            // Also print kitchen docket automatically
            const kitchenResult = await window.electronAPI.printReceipt({
              orderId: response.data.id,
              orderNumber: response.data.orderNumber,
              customerName: response.data.customerName,
              orderType: orderType,
              items: response.data.items,
              subtotal: response.data.subtotal,
              tax: response.data.tax,
              total: response.data.total,
              paymentMethod: 'kitchen', // Mark as kitchen docket
            });
            console.log('Kitchen docket print result:', kitchenResult);
          } else {
            console.warn('Electron print API not available - running in browser mode');
          }
        } else {
          console.log('Print NOT requested - printReceipt:', printReceipt, 'response.data:', !!response.data);
        }

        setShowCheckout(false);
        return { success: true, orderNumber: response.data.orderNumber };
      } else {
        return { success: false, error: response.error };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="pos-btn-primary px-6"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <CategoryTabs
            categories={categories}
            selectedId={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <ProductGrid
              products={displayedProducts}
              currencySymbol={currencySymbol}
              onProductClick={handleProductClick}
            />
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <Cart
            items={cart.items}
            subtotal={cart.subtotal}
            discount={cart.discount}
            discountInfo={cart.discountInfo}
            tax={cart.tax}
            total={cart.total}
            vatRate={vatRate}
            currencySymbol={currencySymbol}
            onUpdateQuantity={cart.updateItemQuantity}
            onEditItem={setEditingItem}
            onRemoveItem={cart.removeItem}
            onClearCart={cart.clearCart}
            onCheckout={() => setShowCheckout(true)}
            onApplyDiscount={() => setShowDiscount(true)}
            onRemoveDiscount={cart.removeDiscount}
            onAddCustomItem={handleAddCustomItem}
            onAddComment={() => setShowComment(true)}
          />
        </div>
      </div>

      {/* Checkout Screen */}
      {showCheckout && (
        <CheckoutScreen
          items={cart.items}
          total={cart.total}
          subtotal={cart.subtotal}
          tax={cart.tax}
          discount={cart.discount}
          currencySymbol={currencySymbol}
          onConfirm={handleCheckout}
          onCancel={() => setShowCheckout(false)}
        />
      )}

      {/* Discount Modal */}
      {showDiscount && (
        <DiscountModal
          subtotal={cart.subtotal}
          currencySymbol={currencySymbol}
          onApplyPercentage={cart.applyDiscount.bind(null, 'percentage')}
          onApplyFixed={cart.applyDiscount.bind(null, 'fixed')}
          onApplyCoupon={cart.applyCoupon}
          onCancel={() => setShowDiscount(false)}
        />
      )}

      {/* Comment Modal */}
      {showComment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Order Comment</h3>
            
            <textarea
              value={orderComment}
              onChange={(e) => setOrderComment(e.target.value)}
              placeholder="Add a comment for this order..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-32"
              autoFocus
            />
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowComment(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Order comment saved in state, can be used during checkout
                  setShowComment(false);
                }}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          onSave={cart.updateItem}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
