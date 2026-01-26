import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Menu } from './components/Menu';
import { Cart } from './components/Cart';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderConfirmation } from './components/OrderConfirmation';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  image?: string;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Settings {
  shopName: string;
  currencySymbol: string;
  vatRate: number;
}

function AppContent() {
  const { user, signOut, isConfigured } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>({
    shopName: 'Kebab Shop',
    currencySymbol: '£',
    vatRate: 20,
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<{ orderNumber: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsRes, categoriesRes, settingsRes] = await Promise.all([
          fetch(`${API_URL}/api/products?available=true`).then((r) => r.json()),
          fetch(`${API_URL}/api/categories?active=true`).then((r) => r.json()),
          fetch(`${API_URL}/api/settings`).then((r) => r.json()),
        ]);

        if (productsRes.success) setProducts(productsRes.data);
        if (categoriesRes.success) setCategories(categoriesRes.data);
        if (settingsRes.success) setSettings(settingsRes.data);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === itemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * (settings.vatRate / 100);
  const total = subtotal + tax;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const submitOrder = async (customerInfo: { name: string; phone: string }) => {
    try {
      const orderData = {
        type: 'online',
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        customerName: user?.user_metadata?.full_name || customerInfo.name,
        customerPhone: user?.user_metadata?.phone || customerInfo.phone,
        customerEmail: user?.email,
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (data.success) {
        setConfirmedOrder({ orderNumber: data.data.orderNumber });
        clearCart();
        setShowCheckout(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      alert(`Order failed: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (confirmedOrder) {
    return (
      <OrderConfirmation
        orderNumber={confirmedOrder.orderNumber}
        onNewOrder={() => setConfirmedOrder(null)}
      />
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Header
        shopName={settings.shopName}
        cartCount={cartCount}
        onCartClick={() => setShowCart(true)}
        user={user}
        onAuthClick={() => setShowAuth(true)}
        onSignOut={signOut}
        showAuth={isConfigured}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Menu
          products={products}
          categories={categories}
          currencySymbol={settings.currencySymbol}
          onAddToCart={addToCart}
        />
      </main>

      {/* Fixed Cart Button (Mobile) */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:hidden">
          <button
            onClick={() => setShowCart(true)}
            className="btn-primary w-full flex justify-between items-center"
          >
            <span>View Cart ({cartCount} items)</span>
            <span className="font-bold">{settings.currencySymbol}{total.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <Cart
          items={cart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          vatRate={settings.vatRate}
          currencySymbol={settings.currencySymbol}
          onUpdateQuantity={updateQuantity}
          onClearCart={clearCart}
          onCheckout={() => {
            setShowCart(false);
            setShowCheckout(true);
          }}
          onClose={() => setShowCart(false)}
        />
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          total={total}
          currencySymbol={settings.currencySymbol}
          onSubmit={submitOrder}
          onCancel={() => setShowCheckout(false)}
          user={user}
        />
      )}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
