import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/products', label: 'Products', icon: '🥙' },
  { to: '/categories', label: 'Categories', icon: '📁' },
  { to: '/modifiers', label: 'Modifiers', icon: '🔧' },
  { to: '/orders', label: 'Orders', icon: '📋' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-sm">
        <div className="p-6 border-b bg-primary-600">
          <div className="flex flex-col items-center gap-2">
            {/* Logo - Place your logo.png in the public folder */}
            <img 
              src="/logo.png" 
              alt="Kebab POS Logo" 
              className="h-16 w-auto object-contain"
              onError={(e) => {
                // Fallback if logo doesn't exist - show text instead
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  parent.innerHTML = '<h1 class="text-xl font-bold text-white">Kebab POS</h1>';
                }
              }}
            />
            <p className="text-sm text-primary-100">Admin Portal</p>
          </div>
        </div>

        <nav className="p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 w-64 p-4 border-t bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-800">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
