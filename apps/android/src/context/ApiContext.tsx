import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

  const { getAccessToken } = auth;

  const fetchApi = useCallback(async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const url = `${apiUrl}${endpoint}`;

    const call = async (token: string | null) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }

      return fetch(url, { ...options, headers });
    };

    // Resolved per request rather than read from auth.session, which is a snapshot
    // that goes stale the moment the background refresh timer misses a beat. Nearly
    // every call in the app comes through here, so one expired token took out the
    // orders tab, the menu, reprints and the kitchen auto-print queue together.
    let response = await call(await getAccessToken());

    // One forced refresh and one replay. The auth middleware rejects a 401 before the
    // route body runs, so no order can have been written and the retry is safe.
    if (response.status === 401) {
      const refreshed = await getAccessToken(true);
      if (refreshed) response = await call(refreshed);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }, [apiUrl, getAccessToken]);

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
