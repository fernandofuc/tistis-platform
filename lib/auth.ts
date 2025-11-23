import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';

// Browser client - direct initialization
// Environment variables are inlined at build time by Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Log at module load for debugging
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) : 'NOT SET'
  });
}

// Create client - will work without throwing if vars are empty (for static pages)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Helper to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

// Types
export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface Client {
  id: string;
  user_id: string;
  business_name: string | null;
  business_type: string | null;
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  vertical: string;
  status: string;
  onboarding_completed: boolean;
  created_at: string;
}

// Hook for auth state
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (mounted) {
          if (error) {
            console.error('🔴 Error getting session:', error);
            setState(prev => ({
              ...prev,
              loading: false,
              error: error.message,
            }));
          } else {
            console.log('🟢 Session fetched:', {
              hasSession: !!session,
              userId: session?.user?.id,
              email: session?.user?.email,
            });

            setState(prev => ({
              ...prev,
              session,
              user: session?.user ?? null,
              loading: false,
              error: null,
            }));

            // Fetch client data if logged in
            if (session?.user) {
              await fetchClient(session.user.id);
            }
          }
        }
      } catch (err) {
        console.error('🔴 Exception getting session:', err);
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }));
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔵 Auth state changed:', { event, hasSession: !!session });

        if (mounted) {
          setState(prev => ({
            ...prev,
            session,
            user: session?.user ?? null,
            loading: false,
          }));

          if (session?.user) {
            await fetchClient(session.user.id);
          } else {
            setClient(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchClient = async (userId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data && !error) {
      setClient(data);
    }
  };

  const signUp = async (email: string, password: string, metadata?: { name?: string }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error };
    }

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      loading: false,
    }));

    return { data };
  };

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error };
    }

    setState(prev => ({
      ...prev,
      user: data.user,
      session: data.session,
      loading: false,
    }));

    return { data };
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error };
    }

    setState({
      user: null,
      session: null,
      loading: false,
      error: null,
    });
    setClient(null);

    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    return { error };
  };

  return {
    user: state.user,
    session: state.session,
    client,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.session,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refetchClient: () => state.user && fetchClient(state.user.id),
  };
}

// Server-side auth helpers
export async function getServerSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Update client data
export async function updateClient(clientId: string, data: Partial<Client>) {
  const { data: updated, error } = await supabase
    .from('clients')
    .update(data)
    .eq('id', clientId)
    .select()
    .single();

  return { data: updated, error };
}
