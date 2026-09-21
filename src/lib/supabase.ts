import { createSafeSupabaseClient, isSupabaseDisabled } from '../../components/lib/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (!isSupabaseDisabled() && supabaseUrl && supabaseAnonKey) 
  ? createSafeSupabaseClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.info('[Supabase] Supabase client is disabled or unconfigured in this environment (zero egress mode).');
}

export default supabase;
