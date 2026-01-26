import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import logo from '../assets/logo.png';

interface HeaderProps {
  shopName: string;
  cartCount: number;
  onCartClick: () => void;
  user?: User | null;
  onAuthClick?: () => void;
  onSignOut?: () => void;
  showAuth?: boolean;
}

export function Header({
  shopName,
  cartCount,
  onCartClick,
  user,
  onAuthClick,
  onSignOut,
  showAuth = false,
}: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="bg-primary-500 text-white sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt={shopName} className="h-10 w-auto" />
          <div>
            <h1 className="text-xl font-bold">{shopName}</h1>
            <p className="text-primary-100 text-sm">Order Online</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Account Button */}
          {showAuth && (
            <div className="relative">
              {user ? (
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors flex items-center gap-2"
                >
                  <span className="text-sm hidden sm:inline">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={onAuthClick}
                  className="bg-white/20 hover:bg-white/30 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
              )}

              {/* Dropdown Menu */}
              {showMenu && user && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-20 text-gray-800">
                    <div className="px-4 py-2 border-b">
                      <p className="font-medium truncate">{user.user_metadata?.full_name}</p>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onSignOut?.();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cart Button */}
          <button
            onClick={onCartClick}
            className="relative bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-primary-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
