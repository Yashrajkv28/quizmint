import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateEmail: (newEmail: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Supabase fires PASSWORD_RECOVERY after the recovery link is parsed. We stay on a
      // reset-password screen until the user sets a new password (or navigates away).
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // When the user clicks the confirmation link, they come back to whichever origin they signed up on.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    // If email confirmation is on, user will be set but session will be null.
    const needsEmailConfirmation = !!data.user && !data.session;
    return { needsEmailConfirmation };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  };

  const deleteAccount = async (password: string) => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s?.user?.email) throw new Error('Not signed in.');
    // Re-authenticate with the supplied password so a hijacked browser session can't
    // nuke the account silently. signInWithPassword refreshes the session on success
    // and fails fast with a clean error on a wrong password.
    const { error: pwErr } = await supabase.auth.signInWithPassword({
      email: s.user.email,
      password,
    });
    if (pwErr) throw new Error('Incorrect password.');
    const { data: { session: fresh } } = await supabase.auth.getSession();
    if (!fresh) throw new Error('Session lost during re-authentication.');
    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fresh.access_token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as any));
      throw new Error(body.error || `Could not delete account (${res.status}).`);
    }
    await supabase.auth.signOut();
  };

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    isPasswordRecovery,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
    updateEmail,
    deleteAccount,
    clearPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
