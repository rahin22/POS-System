import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const API_URL = 'https://kebab-posbackend-production.up.railway.app';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>;
  fetchApi: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Resolve an access token that is actually still valid.
   *
   * The token must never be read straight out of React state. Supabase access tokens
   * last an hour and the only thing that renewed them was the library's background
   * timer, which on the Sunmi is frozen whenever the device sleeps or the WebView is
   * backgrounded. When that timer misses, nothing else ever retries: the app keeps
   * presenting the same dead JWT and the backend keeps answering "Invalid token"
   * until somebody logs out and back in by hand. A session on the shop's terminal
   * went seven days without a single refresh that way.
   *
   * getSession() renews the token when it has expired, so going through here on every
   * request means an idle device repairs itself on its next call instead of wedging.
   */
  const getAccessToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    try {
      if (forceRefresh) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) return null;
        setSession(data.session);
        return data.session.access_token;
      }

      const { data: { session: current } } = await supabase.auth.getSession();
      if (!current) return null;

      // Only re-render when the token actually changed, since this runs per request
      setSession((prev) => (prev?.access_token === current.access_token ? prev : current));
      return current.access_token;
    } catch (error) {
      console.error('Failed to resolve access token:', error);
      return null;
    }
  }, []);

  const fetchApi = useCallback(async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const call = async (token: string | null) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      return fetch(`${API_URL}${endpoint}`, { ...options, headers });
    };

    let response = await call(await getAccessToken());

    // A 401 is refused by the auth middleware before the route runs, so nothing was
    // written and replaying the request cannot duplicate an order.
    if (response.status === 401) {
      const refreshed = await getAccessToken(true);
      if (refreshed) response = await call(refreshed);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }, [getAccessToken]);

  // Fetch user info from backend
  const fetchUserInfo = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  }, []);

  // Check auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.access_token) {
        await fetchUserInfo(session.access_token);
      }
      
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      
      if (session?.access_token) {
        await fetchUserInfo(session.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserInfo]);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        await fetchUserInfo(data.session.access_token);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, logout, getAccessToken, fetchApi }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
