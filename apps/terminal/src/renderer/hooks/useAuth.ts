import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const API_URL = 'https://kebab-posbackend-production.up.railway.app';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user info from backend - returns error if user is not staff/admin
  const fetchUserInfo = useCallback(async (accessToken: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        return { success: true };
      } else {
        // Backend rejected - user not in staff table
        return { success: false, error: data.error || 'Access denied' };
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      return { success: false, error: 'Failed to connect to server' };
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      
      if (session?.access_token) {
        await fetchUserInfo(session.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserInfo]);

  const login = useCallback(async (email: string, password: string) => {
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
        
        // Check if user is authorized as staff/admin
        const userResult = await fetchUserInfo(data.session.access_token);
        if (!userResult.success) {
          // Sign out if not a staff member
          await supabase.auth.signOut();
          setSession(null);
          return { success: false, error: userResult.error || 'Access denied. Staff account required.' };
        }
        
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [fetchUserInfo]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback(() => {
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
    return {};
  }, [session]);

  return { user, session, isLoading, login, logout, getAuthHeaders };
}
