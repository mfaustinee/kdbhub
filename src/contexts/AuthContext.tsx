import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../components/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initAuth = async () => {
      try {
        const client: SupabaseClient | null = await getSupabase();
        if (!client) {
          if (isMounted) {
            setIsConfigured(false);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setIsConfigured(true);
        }

        // Get initial session
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.warn('[AuthContext] Session retrieval error:', error.message);
        }

        if (isMounted) {
          setSession(data?.session || null);
          setUser(data?.session?.user || null);
          setIsLoading(false);
        }

        // Listen for state changes (sign in, sign out, token refresh)
        const { data: authListener } = client.auth.onAuthStateChange((_event, currentSession) => {
          if (isMounted) {
            setSession(currentSession);
            setUser(currentSession?.user || null);
            setIsLoading(false);
          }
        });

        authSubscription = authListener.subscription;
      } catch (err) {
        console.error('[AuthContext] Auth initialization failed:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = await getSupabase();
      if (!client) {
        return {
          success: false,
          error: 'Supabase credentials are not configured. Please check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY settings.'
        };
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setUser(data.user);
      setSession(data.session);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'An unexpected error occurred during sign-in.' };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string): Promise<{ success: boolean; error?: string; message?: string }> => {
    try {
      const client = await getSupabase();
      if (!client) {
        return {
          success: false,
          error: 'Supabase credentials are not configured.'
        };
      }

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role: 'admin'
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Check if email confirmation is required by Supabase
      if (data.user && !data.session) {
        return {
          success: true,
          message: 'Account created! Please check your email inbox to confirm your registration before signing in.'
        };
      }

      if (data.session) {
        setUser(data.user);
        setSession(data.session);
      }

      return {
        success: true,
        message: 'Admin account registered and authenticated successfully.'
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'An unexpected error occurred during sign-up.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const client = await getSupabase();
      if (client) {
        await client.auth.signOut();
      }
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = await getSupabase();
      if (!client) {
        return { success: false, error: 'Supabase credentials are not configured.' };
      }

      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/admin'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send password reset request.' };
    }
  };

  const isAuthenticated = Boolean(user && session);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isLoading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
