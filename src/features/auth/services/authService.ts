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
    const tenantId = await getTenantId();

    if (!tenantId) {
      console.log('🟡 No tenant_id found');
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
    // Get user data including metadata
    const { data: { user } } = await supabase.auth.getUser();
    let tenantId = await getTenantId();

    // If no tenant_id, try to sync metadata from server
    if (!tenantId && user) {
      console.log('🟡 No tenant_id found, attempting to sync metadata...');

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const syncResponse = await fetch('/api/admin/sync-tenant-metadata', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          const syncResult = await syncResponse.json();
          console.log('🔄 Sync metadata result:', syncResult);

          if (syncResult.success && syncResult.tenant_id) {
            tenantId = syncResult.tenant_id;
            console.log('🟢 Got tenant_id from sync:', tenantId);
          }
        }
      } catch (syncError) {
        console.error('🔴 Error syncing metadata:', syncError);
      }
    }

    // If still no tenant_id, try to find staff record by email only as last resort
    if (!tenantId) {
      console.log('🟡 No tenant_id, searching staff by email only:', email);

      // Try to find any staff with this email
      const { data: staffByEmail } = await supabase
        .from('staff')
        .select('*')
        .eq('email', email)
        .limit(1)
        .single();

      if (staffByEmail) {
        console.log('🟢 Found staff by email, tenant_id:', staffByEmail.tenant_id);

        // Try to sync this tenant_id to metadata in background (don't wait)
        if (user && staffByEmail.tenant_id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            // Fire and forget - sync metadata for future sessions
            fetch('/api/admin/sync-tenant-metadata', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }).catch(() => {}); // Ignore errors, this is non-critical
          }
        }

        // Return the staff even without tenant_id in metadata
        return staffByEmail as Staff;
      }

      console.log('🟡 No tenant_id and no staff found for:', email);
      return null;
    }

    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single();

    // If no staff record exists, create one via API (bypasses RLS)
    if (error && error.code === 'PGRST116') {
      console.log('🟡 No staff record found for email, creating via API:', email);

      try {
        // Get current session token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.error('🔴 No session token available');
          return null;
        }

        // Call API endpoint that uses service role
        const response = await fetch('/api/auth/ensure-staff', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (!response.ok) {
          console.error('🔴 API error creating staff:', result.error, result.details);
          return null;
        }

        console.log('🟢 Staff record created via API:', result.staff?.display_name);

        // Fetch the complete staff record
        const { data: newStaff } = await supabase
          .from('staff')
          .select('*')
          .eq('email', email)
          .eq('tenant_id', tenantId)
          .single();

        return newStaff as Staff;
      } catch (apiError) {
        console.error('🔴 Exception creating staff via API:', apiError);
        return null;
      }
    }

    if (error) {
      console.error('🔴 Fetch staff by email error:', error.message);
      return null;
    }

    // Enrich staff data with user metadata if staff fields are empty
    // This ensures profile shows data from checkout/discovery
    const enrichedStaff = { ...data } as Staff;

    if (user?.user_metadata) {
      const meta = user.user_metadata;

      // If staff first_name is empty, use from user_metadata
      if (!enrichedStaff.first_name && meta.first_name) {
        enrichedStaff.first_name = meta.first_name;
      }
      if (!enrichedStaff.last_name && meta.last_name) {
        enrichedStaff.last_name = meta.last_name;
      }
      if (!enrichedStaff.phone && meta.phone) {
        enrichedStaff.phone = meta.phone;
      }

      // Update display_name if it's missing or just "Admin"
      if ((!enrichedStaff.display_name || enrichedStaff.display_name === 'Admin') && meta.name) {
        enrichedStaff.display_name = meta.name;
      }

      // Ensure email is always from the authenticated user
      if (user.email) {
        enrichedStaff.email = user.email;
      }
    }

    console.log('🟢 Staff fetched by email:', enrichedStaff.display_name);
    return enrichedStaff;
  } catch (err) {
    console.error('🔴 Fetch staff by email exception:', err);
    return null;
  }
}

// ======================
// HELPER: Get tenant_id with fallback
// ======================
async function getTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();

  // Method 1: Try user_metadata (fast)
  const metaTenantId = user?.user_metadata?.tenant_id;
  if (metaTenantId) {
    return metaTenantId;
  }

  // Method 2: Fallback to user_roles table
  if (user?.id) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (roleData?.tenant_id) {
      console.log('🟡 Got tenant_id from user_roles (fallback)');
      return roleData.tenant_id;
    }
  }

  console.log('🟡 No tenant_id found in metadata or user_roles');
  return null;
}

// ======================
// TENANT & BRANCHES
// Now multi-tenant aware with fallback
// ======================
export async function fetchTenant(): Promise<Tenant | null> {
  try {
    const tenantId = await getTenantId();

    if (!tenantId) {
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
    const tenantId = await getTenantId();

    if (!tenantId) {
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
// UPDATE TENANT (Identidad del Negocio)
// Solo campos editables: name, legal_name, primary_contact_phone
// Email es readonly por seguridad (afecta facturación/auth)
// ======================
export interface UpdateTenantData {
  name?: string;
  legal_name?: string;
  primary_contact_phone?: string;
}

export async function updateTenant(data: UpdateTenantData): Promise<{ success: boolean; error?: string; tenant?: Tenant }> {
  try {
    // Get tenant_id from user metadata
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id;

    if (!tenantId) {
      console.log('🟡 No tenant_id in user metadata');
      return { success: false, error: 'No se encontró el tenant' };
    }

    // Validate: at least one field must be provided
    if (!data.name && !data.legal_name && !data.primary_contact_phone) {
      return { success: false, error: 'No hay datos para actualizar' };
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      // Validate name is not empty
      if (!data.name.trim()) {
        return { success: false, error: 'El nombre comercial no puede estar vacío' };
      }
      updateData.name = data.name.trim();
    }

    if (data.legal_name !== undefined) {
      updateData.legal_name = data.legal_name.trim() || null;
    }

    if (data.primary_contact_phone !== undefined) {
      updateData.primary_contact_phone = data.primary_contact_phone.trim() || null;
    }

    updateData.updated_at = new Date().toISOString();

    const { data: updatedTenant, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('🔴 Update tenant error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('🟢 Tenant updated:', updatedTenant.name);
    return { success: true, tenant: updatedTenant as Tenant };
  } catch (err) {
    console.error('🔴 Update tenant exception:', err);
    return { success: false, error: 'Error inesperado al actualizar datos del negocio' };
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
