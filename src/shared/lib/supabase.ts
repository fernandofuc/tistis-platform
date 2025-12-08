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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
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
// ESVA TENANT CONSTANT
// ======================
export const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// DEBUG LOGGING
// ======================
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 Supabase config:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPreview: supabaseUrl ? supabaseUrl.substring(0, 30) : 'NOT SET',
    tenantId: ESVA_TENANT_ID,
  });
}
