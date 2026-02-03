import { useState, useEffect } from 'react';
import { POSLayout } from './components/POSLayout';
import { OrdersPage } from './components/OrdersPage';
import { MenuPage } from './components/MenuPage';
import { SettingsPage } from './components/SettingsPage';
import { LoginScreen } from './components/LoginScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ApiProvider, useApi } from './context/ApiContext';
import logo from './assets/logo.png';

type Page = 'pos' | 'orders' | 'menu' | 'settings';

function App() {
  return (
    <AuthProvider>
      <ApiProvider>
        <AppContent />
      </ApiProvider>
    </AuthProvider>
  );
}

function AppContent() {
  const { user, isLoading, login, logout } = useAuth();
  const { fetchApi } = useApi();
  const [currentPage, setCurrentPage] = useState<Page>('pos');
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Load settings
  useEffect(() => {
    if (user) {
      const loadSettings = async () => {
        try {
          const response = await fetchApi<{ success: boolean; data: any }>('/api/settings');
          if (response.success) {
            setCurrencySymbol(response.data.currencySymbol || '$');
          }
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      };
      loadSettings();
    }
  }, [user, fetchApi]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-primary-700 text-white flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <img 
            src={logo} 
            alt="Kebab POS" 
            className="h-8 w-auto" 
          />
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage('pos')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 'pos'
                ? 'bg-white text-primary-700'
                : 'hover:bg-primary-600'
            }`}
          >
            POS
          </button>
          <button
            onClick={() => setCurrentPage('orders')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 'orders'
                ? 'bg-white text-primary-700'
                : 'hover:bg-primary-600'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setCurrentPage('menu')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 'menu'
                ? 'bg-white text-primary-700'
                : 'hover:bg-primary-600'
            }`}
          >
            Menu
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentPage === 'settings'
                ? 'bg-white text-primary-700'
                : 'hover:bg-primary-600'
            }`}
          >
            Settings
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">{user.name}</span>
          <button
            onClick={logout}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden">
        {currentPage === 'pos' && <POSLayout />}
        {currentPage === 'orders' && <OrdersPage currencySymbol={currencySymbol} />}
        {currentPage === 'menu' && <MenuPage currencySymbol={currencySymbol} />}
        {currentPage === 'settings' && <SettingsPage />}
      </div>
    </div>
  );
}

export default App;
