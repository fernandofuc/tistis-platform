// =====================================================
// TIS TIS PLATFORM - Auth Service
// =====================================================

import { supabase, ESVA_TENANT_ID } from '@/shared/lib/supabase';
import type { Staff, Branch, Tenant } from '@/shared/types';
import type { SignUpData, AuthResult } from '../types';

// ======================
// AUTH OPERATIONS
// ======================
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('🔴 Sign in error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('🟢 Sign in successful:', data.user?.email);
    return { success: true, user: data.user ?? undefined };
  } catch (err) {
    console.error('🔴 Sign in exception:', err);
    return { success: false, error: 'Error inesperado al iniciar sesión' };
  }
}

export async function signUp(data: SignUpData): Promise<AuthResult> {
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
        },
      },
    });

    if (error) {
      console.error('🔴 Sign up error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('🟢 Sign up successful:', authData.user?.email);
    return { success: true, user: authData.user ?? undefined };
  } catch (err) {
    console.error('🔴 Sign up exception:', err);
    return { success: false, error: 'Error inesperado al registrarse' };
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('🔴 Sign out error:', error.message);
    throw new Error(error.message);
  }
  console.log('🟢 Sign out successful');
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    console.error('🔴 Reset password error:', error.message);
    return { error: error.message };
  }

  console.log('🟢 Reset password email sent to:', email);
  return { error: null };
}

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('🔴 Update password error:', error.message);
    return { error: error.message };
  }

  console.log('🟢 Password updated successfully');
  return { error: null };
}

// ======================
// STAFF OPERATIONS
// ======================
export async function fetchStaffByUserId(userId: string): Promise<Staff | null> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', ESVA_TENANT_ID)
      .single();

    if (error) {
      // Staff might not exist for this user
      if (error.code === 'PGRST116') {
        console.log('🟡 No staff record found for user:', userId);
        return null;
      }
      console.error('🔴 Fetch staff error:', error.message);
      return null;
    }

    console.log('🟢 Staff fetched:', data.display_name);
    return data as Staff;
  } catch (err) {
    console.error('🔴 Fetch staff exception:', err);
    return null;
  }
}

export async function fetchStaffByEmail(email: string): Promise<Staff | null> {
  try {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', ESVA_TENANT_ID)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('🟡 No staff record found for email:', email);
        return null;
      }
      console.error('🔴 Fetch staff by email error:', error.message);
      return null;
    }

    console.log('🟢 Staff fetched by email:', data.display_name);
    return data as Staff;
  } catch (err) {
    console.error('🔴 Fetch staff by email exception:', err);
    return null;
  }
}

// ======================
// TENANT & BRANCHES
// ======================
export async function fetchTenant(): Promise<Tenant | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', ESVA_TENANT_ID)
      .single();

    if (error) {
      console.error('🔴 Fetch tenant error:', error.message);
      return null;
    }

    console.log('🟢 Tenant fetched:', data.name);
    return data as Tenant;
  } catch (err) {
    console.error('🔴 Fetch tenant exception:', err);
    return null;
  }
}

export async function fetchBranches(): Promise<Branch[]> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', ESVA_TENANT_ID)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .order('name');

    if (error) {
      console.error('🔴 Fetch branches error:', error.message);
      return [];
    }

    console.log('🟢 Branches fetched:', data.length);
    return data as Branch[];
  } catch (err) {
    console.error('🔴 Fetch branches exception:', err);
    return [];
  }
}

// ======================
// SESSION
// ======================
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('🔴 Get session error:', error.message);
    return null;
  }

  return data.session;
}

export function onAuthStateChange(callback: (session: unknown) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session);
    }
  );

  return subscription;
}
