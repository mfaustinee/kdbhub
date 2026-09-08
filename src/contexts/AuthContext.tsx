import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../components/lib/supabase';
import { generateTotpSecret, generateTotpUri, verifyTotpCode, generateBackupCodes } from '../utils/totp';

const MFA_SESSION_KEY = 'kdb_admin_mfa_verified';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isMfaVerified: boolean;
  mfaPending: boolean;
  mfaMode: 'verify' | 'setup' | null;
  mfaSecret: string | null;
  mfaUri: string | null;
  backupCodes: string[];
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresMfa?: boolean; mode?: 'verify' | 'setup' }>;
  verifyMfa: (code: string) => Promise<{ success: boolean; error?: string }>;
  setupNewMfa: () => Promise<{ success: boolean; secret: string; uri: string }>;
  cancelMfa: () => Promise<void>;
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

  // Multi-Factor Authentication (MFA) State
  const [isMfaVerified, setIsMfaVerified] = useState<boolean>(false);
  const [mfaPending, setMfaPending] = useState<boolean>(false);
  const [mfaMode, setMfaMode] = useState<'verify' | 'setup' | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

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
          const activeUser = data?.session?.user || null;
          setSession(data?.session || null);
          setUser(activeUser);

          // Set user and session directly without MFA enforcement
          if (activeUser) {
            setIsMfaVerified(true);
            setMfaPending(false);
          } else {
            setIsMfaVerified(false);
            setMfaPending(false);
          }

          setIsLoading(false);
        }

        // Listen for state changes (sign in, sign out, token refresh)
        const { data: authListener } = client.auth.onAuthStateChange((_event, currentSession) => {
          if (isMounted) {
            const newUser = currentSession?.user || null;
            setSession(currentSession);
            setUser(newUser);

            if (!newUser) {
              setIsMfaVerified(false);
              setMfaPending(false);
              setMfaMode(null);
              sessionStorage.removeItem(MFA_SESSION_KEY);
            }

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

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string; requiresMfa?: boolean; mode?: 'verify' | 'setup' }> => {
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

      const signedInUser = data.user;
      setUser(signedInUser);
      setSession(data.session);

      if (!signedInUser) {
        return { success: false, error: 'User profile not returned.' };
      }

      setIsMfaVerified(true);
      setMfaPending(false);
      return { success: true, requiresMfa: false };
    } catch (err: any) {
      return { success: false, error: err?.message || 'An unexpected error occurred during sign-in.' };
    }
  };

  const setupNewMfa = async (): Promise<{ success: boolean; secret: string; uri: string }> => {
    const newSecret = generateTotpSecret();
    const uri = generateTotpUri(newSecret, user?.email || 'admin');
    const codes = generateBackupCodes();
    setMfaSecret(newSecret);
    setMfaUri(uri);
    setBackupCodes(codes);
    setMfaMode('setup');
    setMfaPending(true);
    return { success: true, secret: newSecret, uri };
  };

  const verifyMfa = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No active authentication session found.' };
    }

    const cleanCode = code.trim();
    if (!cleanCode) {
      return { success: false, error: 'Please enter the 6-digit authentication code.' };
    }

    try {
      if (mfaMode === 'setup') {
        if (!mfaSecret) {
          return { success: false, error: 'MFA setup secret not generated.' };
        }

        const isValid = await verifyTotpCode(cleanCode, mfaSecret);
        if (!isValid) {
          return { success: false, error: 'Invalid authenticator code. Please check your app clock and try again.' };
        }

        // Successfully enrolled: Persist secret and backup codes
        localStorage.setItem(`kdb_mfa_secret_${user.id}`, mfaSecret);
        localStorage.setItem(`kdb_mfa_backup_${user.id}`, JSON.stringify(backupCodes));
        sessionStorage.setItem(MFA_SESSION_KEY, user.id);

        setIsMfaVerified(true);
        setMfaPending(false);
        setMfaMode(null);
        return { success: true };
      }

      // Mode: 'verify'
      const storedSecret = mfaSecret || localStorage.getItem(`kdb_mfa_secret_${user.id}`);
      if (!storedSecret) {
        return { success: false, error: 'MFA configuration missing. Please re-enroll.' };
      }

      // 1. Try TOTP code
      let isValid = await verifyTotpCode(cleanCode, storedSecret);

      // 2. Try Emergency Backup Codes if not 6 digits
      if (!isValid) {
        const storedBackups = localStorage.getItem(`kdb_mfa_backup_${user.id}`);
        if (storedBackups) {
          try {
            const codes: string[] = JSON.parse(storedBackups);
            const normalizedInput = cleanCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
            const matchingIdx = codes.findIndex(c => c.replace(/[^A-Z0-9]/g, '') === normalizedInput);
            if (matchingIdx !== -1) {
              isValid = true;
              // Remove used backup code
              codes.splice(matchingIdx, 1);
              localStorage.setItem(`kdb_mfa_backup_${user.id}`, JSON.stringify(codes));
            }
          } catch (e) {
            console.warn('[MFA] Backup codes parse error:', e);
          }
        }
      }

      if (!isValid) {
        return { success: false, error: 'Invalid authentication or backup recovery code.' };
      }

      sessionStorage.setItem(MFA_SESSION_KEY, user.id);
      setIsMfaVerified(true);
      setMfaPending(false);
      setMfaMode(null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'MFA validation failed.' };
    }
  };

  const cancelMfa = async (): Promise<void> => {
    setIsMfaVerified(false);
    setMfaPending(false);
    setMfaMode(null);
    await signOut();
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

      if (data.session && data.user) {
        setUser(data.user);
        setSession(data.session);
        // Force MFA enrollment on new accounts
        const newSecret = generateTotpSecret();
        const uri = generateTotpUri(newSecret, data.user.email || 'admin');
        const codes = generateBackupCodes();
        setMfaSecret(newSecret);
        setMfaUri(uri);
        setBackupCodes(codes);
        setMfaMode('setup');
        setMfaPending(true);
        setIsMfaVerified(false);
      }

      return {
        success: true,
        message: 'Admin account registered successfully. Please proceed with MFA enrollment.'
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
      setIsMfaVerified(false);
      setMfaPending(false);
      setMfaMode(null);
      sessionStorage.removeItem(MFA_SESSION_KEY);
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

  // User is authenticated when valid user and session are present
  const isAuthenticated = Boolean(user && session);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isMfaVerified,
        mfaPending,
        mfaMode,
        mfaSecret,
        mfaUri,
        backupCodes,
        isLoading,
        isConfigured,
        signIn,
        verifyMfa,
        setupNewMfa,
        cancelMfa,
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
