import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { settings as platformSettings } from '../lib/platform';

interface ApiContextType {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  fetchApi: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
}

const ApiContext = createContext<ApiContextType | null>(null);

const DEFAULT_API_URL = 'https://kebab-posbackend-production.up.railway.app';

export function ApiProvider({ children }: { children: ReactNode }) {
  const [apiUrl, setApiUrlState] = useState(DEFAULT_API_URL);
  const auth = useAuth();

  // Load settings from Capacitor Preferences on mount
  useEffect(() => {
    const loadSettings = async () => {
      const savedUrl = await platformSettings.get('apiUrl', DEFAULT_API_URL);
      setApiUrlState(savedUrl);
    };
    loadSettings();
  }, []);

  const setApiUrl = async (url: string) => {
    setApiUrlState(url);
    await platformSettings.set('apiUrl', url);
  };

  const fetchApi = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${apiUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Use Supabase token from AuthContext
    if (auth.session?.access_token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${auth.session.access_token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  };

  return (
    <ApiContext.Provider value={{ apiUrl, setApiUrl, fetchApi }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
}
