// =====================================================
// TIS TIS PLATFORM - Auth Service
// Multi-tenant aware - gets tenant_id from user metadata
// =====================================================

import { supabase } from '@/shared/lib/supabase';
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
// Now multi-tenant aware - uses user's tenant_id from metadata
// ======================
export async function fetchStaffByUserId(userId: string): Promise<Staff | null> {
  try {
    // Get tenant_id from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata');
      return null;
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
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
    // Get tenant_id from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata for:', email);
      return null;
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', tenantId)
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
// Now multi-tenant aware
// ======================
export async function fetchTenant(): Promise<Tenant | null> {
  try {
    // Get tenant_id from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata');
      return null;
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
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
    // Get tenant_id from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata');
      return [];
    }

    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenantId)
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

// ======================
// UPDATE STAFF PROFILE
// ======================
export interface UpdateStaffData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  whatsapp_number?: string;
  avatar_url?: string;
}

export async function updateStaff(staffId: string, data: UpdateStaffData): Promise<{ success: boolean; error?: string; staff?: Staff }> {
  try {
    // Get tenant_id from user metadata for security
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata');
      return { success: false, error: 'No se encontró el tenant' };
    }

    // Build display_name from first_name and last_name
    const updateData: Record<string, unknown> = { ...data };
    if (data.first_name || data.last_name) {
      const firstName = data.first_name || '';
      const lastName = data.last_name || '';
      updateData.display_name = `${firstName} ${lastName}`.trim();
    }
    updateData.updated_at = new Date().toISOString();

    const { data: updatedStaff, error } = await supabase
      .from('staff')
      .update(updateData)
      .eq('id', staffId)
      .eq('tenant_id', tenantId) // Security: ensure same tenant
      .select()
      .single();

    if (error) {
      console.error('🔴 Update staff error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('🟢 Staff updated:', updatedStaff.display_name);
    return { success: true, staff: updatedStaff as Staff };
  } catch (err) {
    console.error('🔴 Update staff exception:', err);
    return { success: false, error: 'Error inesperado al actualizar perfil' };
  }
}
