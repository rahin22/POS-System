import { createClient } from '@supabase/supabase-js';

// These will come from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Customer auth will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
