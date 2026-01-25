// =====================================================
// TIS TIS PLATFORM - Shared Types Index
// =====================================================

export * from './database';
export * from './unified-assistant-types';
export * from './delivery-types';

// ======================
// API TYPES
// ======================
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ======================
// FILTER TYPES
// ======================
export interface LeadFilters {
  status?: string[];
  classification?: string[];
  source?: string[];
  branch_id?: string;
  assigned_staff_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface AppointmentFilters {
  status?: string[];
  branch_id?: string;
  staff_id?: string;
  service_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface ConversationFilters {
  status?: string[];
  channel?: string;
  ai_handling?: boolean;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
}

// ======================
// DASHBOARD TYPES
// ======================
export interface DashboardStats {
  leads: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    new_today: number;
    trend: number;
  };
  appointments: {
    today: number;
    upcoming: number;
    completed_today: number;
    cancelled_today: number;
  };
  conversations: {
    active: number;
    escalated: number;
    resolved_today: number;
    avg_response_time: number;
  };
  revenue: {
    today: number;
    this_week: number;
    this_month: number;
    trend: number;
  };
}

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'chart' | 'list' | 'calendar';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
}

// ======================
// REALTIME TYPES
// ======================
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T> {
  eventType: RealtimeEvent;
  new: T;
  old: T | null;
  table: string;
}

// ======================
// FORM TYPES
// ======================
export interface LeadFormData {
  name: string;
  phone: string;
  email?: string;
  source: string;
  branch_id?: string;
  interested_services?: string[];
  notes?: string;
}

export interface AppointmentFormData {
  lead_id: string;
  branch_id: string;
  staff_id?: string;
  service_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  notes?: string;
}

export interface MessageFormData {
  content: string;
  conversation_id: string;
}

// ======================
// UI STATE TYPES
// ======================
export interface ModalState {
  isOpen: boolean;
  data?: unknown;
}

export interface DrawerState {
  isOpen: boolean;
  content?: React.ReactNode;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// ======================
// SUPABASE QUERY BUILDER TYPES
// Sprint 2: Replace 'any' with specific types
// ======================

/**
 * Generic type for Supabase query results
 */
export interface SupabaseQueryResult<T> {
  data: T | null;
  error: { message: string; code?: string; details?: string } | null;
  count?: number | null;
  status: number;
  statusText: string;
}

/**
 * Minimal chainable query builder interface
 *
 * NOTE: This is intentionally minimal to:
 * 1. Allow flexible mocking in tests
 * 2. Be compatible with Supabase's actual PostgrestFilterBuilder
 * 3. Provide type safety for the essential .eq() method used in branch filtering
 *
 * The index signature allows additional Supabase methods without requiring
 * them all to be defined explicitly.
 *
 * @example
 * ```typescript
 * function applyFilter<T>(query: SupabaseQueryBuilder<T>): SupabaseQueryBuilder<T> {
 *   return query.eq('branch_id', branchId);
 * }
 * ```
 */
export interface SupabaseQueryBuilder<T = unknown> {
  // Essential filter method for branch filtering
  eq: (column: string, value: unknown) => SupabaseQueryBuilder<T>;

  // Allow any other methods from Supabase query builders
  // This provides flexibility for tests and compatibility with Supabase types
  // Note: Index signature uses 'any' intentionally for Supabase compatibility
  [key: string]: unknown;
}

/**
 * Type alias for backward compatibility
 * Use this in function parameters where you need a generic query builder
 */
export type QueryBuilder<T = unknown> = SupabaseQueryBuilder<T>;

/**
 * Server action result type for Supabase operations
 */
export interface SupabaseActionResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * Supabase client interface (minimal for typing)
 */
export interface SupabaseClientInterface {
  from: (table: string) => SupabaseQueryBuilder<unknown>;
  rpc: (fn: string, params?: Record<string, unknown>) => Promise<SupabaseQueryResult<unknown>>;
  auth: {
    getSession: () => Promise<{ data: { session: unknown }; error: unknown }>;
    getUser: () => Promise<{ data: { user: unknown }; error: unknown }>;
  };
}
