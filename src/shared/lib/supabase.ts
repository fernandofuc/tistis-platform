// =====================================================
// TIS TIS PLATFORM - Supabase Client Configuration
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ======================
// ENVIRONMENT VARIABLES
// ======================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not configured');
}

// ======================
// BROWSER CLIENT (Client-side)
// ======================
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // Session management
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,

      // PKCE flow (more secure for SPAs)
      flowType: 'pkce',

      // Storage key (ensures unique sessions per subdomain)
      storageKey: 'tistis-auth-token',

      // Storage adapter (uses localStorage by default)
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ======================
// SERVER CLIENT (API Routes)
// ======================
// For service-level operations (bypasses RLS)
export function createServerClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not configured, using anon key');
    return supabase;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ======================
// SERVER CLIENT WITH COOKIES (API Routes with auth)
// ======================
// IMPORTANT: For server-side cookie-based auth, import from:
// '@/src/shared/lib/supabase-server' directly in API routes
// Do NOT re-export here to avoid client-side import issues

// ======================
// HELPER FUNCTIONS
// ======================
export function isSupabaseConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

export function getSupabaseUrl(): string {
  return supabaseUrl;
}

// ======================
// REALTIME HELPERS
// ======================
export type RealtimeChannel = ReturnType<typeof supabase.channel>;

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export function subscribeToTable(
  tableName: string,
  callback: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown> | null;
  }) => void,
  filter?: { column: string; value: string }
): RealtimeSubscription {
  const channelName = filter
    ? `${tableName}_${filter.column}_${filter.value}`
    : tableName;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter: filter ? `${filter.column}=eq.${filter.value}` : undefined,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as Record<string, unknown>,
          old: payload.old as Record<string, unknown> | null,
        });
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

// ======================
// DEFAULT TENANT CONSTANT
// ======================
// ⚠️ SECURITY WARNING: DEFAULT_TENANT_ID should ONLY be used for:
// 1. Development/testing with single-tenant deployments
// 2. Public endpoints that don't require user authentication
// 3. Cron jobs or internal service-to-service calls
//
// For authenticated endpoints, ALWAYS use getUserTenantId() to get
// the tenant from the authenticated user's metadata or user_roles table.
// Using DEFAULT_TENANT_ID in authenticated endpoints creates IDOR vulnerabilities.
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// @deprecated Use DEFAULT_TENANT_ID instead - keeping for backwards compatibility
export const ESVA_TENANT_ID = DEFAULT_TENANT_ID;

// ======================
// TENANT HELPER FUNCTIONS
// ======================

/**
 * Get tenant_id from authenticated user's metadata or user_roles
 * IMPORTANT: Use this instead of DEFAULT_TENANT_ID in authenticated endpoints
 *
 * @param supabase - Server client with auth context
 * @returns Promise<{ tenantId: string | null, userId: string | null, error: string | null }>
 */
export async function getUserTenantId(supabase: SupabaseClient): Promise<{
  tenantId: string | null;
  userId: string | null;
  error: string | null;
}> {
  try {
    // Get current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { tenantId: null, userId: null, error: 'Not authenticated' };
    }

    // First, try to get tenant_id from user metadata (faster)
    const metadataTenantId = user.user_metadata?.tenant_id;
    if (metadataTenantId) {
      return { tenantId: metadataTenantId, userId: user.id, error: null };
    }

    // Fallback: Query user_roles table
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return { tenantId: null, userId: user.id, error: 'No tenant assigned to user' };
    }

    return { tenantId: userRole.tenant_id, userId: user.id, error: null };
  } catch (error) {
    console.error('[getUserTenantId] Error:', error);
    return { tenantId: null, userId: null, error: 'Failed to get tenant' };
  }
}

/**
 * Validates that the user has access to the specified tenant
 * Use for endpoints where tenant_id comes from request params/body
 */
export async function validateUserTenantAccess(
  supabase: SupabaseClient,
  requestedTenantId: string
): Promise<{ hasAccess: boolean; userId: string | null; error: string | null }> {
  const { tenantId, userId, error } = await getUserTenantId(supabase);

  if (error) {
    return { hasAccess: false, userId: null, error };
  }

  if (tenantId !== requestedTenantId) {
    return { hasAccess: false, userId, error: 'Access denied to this tenant' };
  }

  return { hasAccess: true, userId, error: null };
}

// ======================
// DEBUG LOGGING
// ======================
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 Supabase config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) : 'NOT SET',
    tenantId: DEFAULT_TENANT_ID,
  });
}
