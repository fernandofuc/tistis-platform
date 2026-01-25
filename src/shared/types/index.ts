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

// ======================
// SECURE BOOKING TYPES
// Phase 7: UI/Dashboard - Booking States System
// ======================

/**
 * Booking Hold Status Type
 * Maps to: booking_holds.status
 */
export type BookingHoldStatus = 'active' | 'converted' | 'expired' | 'released';

/**
 * Confirmation Status Type
 * Maps to: appointments.confirmation_status, restaurant_orders.confirmation_status
 */
export type ConfirmationStatus = 'not_required' | 'pending' | 'confirmed' | 'expired';

/**
 * Deposit Status Type
 * Maps to: booking_deposits.status
 */
export type DepositStatus = 'not_required' | 'required' | 'pending' | 'paid' | 'forfeited' | 'refunded' | 'applied';

/**
 * Customer Trust Level based on score
 */
export type TrustLevel = 'trusted' | 'standard' | 'cautious' | 'high_risk';

/**
 * Combined Booking State for UI
 */
export type BookingCombinedState =
  | 'hold_active'
  | 'pending_confirmation'
  | 'pending_deposit'
  | 'confirmed'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'cancelled';

/**
 * Table Reservation State (Restaurant vertical)
 */
export type TableReservationState = 'hold' | 'reserved' | 'pending_confirmation' | 'seated' | 'available';

/**
 * Booking Hold - Temporary slot reservation during voice/chat
 */
export interface BookingHold {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_phone: string;
  customer_name: string | null;
  slot_datetime: string;
  duration_minutes: number;
  status: BookingHoldStatus;
  hold_type: 'voice_call' | 'chat_session' | 'manual';
  session_id: string | null;
  expires_at: string;
  release_reason: string | null;
  released_at: string | null;
  converted_to_appointment_id: string | null;
  converted_to_order_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Customer Trust Score
 */
export interface CustomerTrustScore {
  id: string;
  tenant_id: string;
  customer_phone: string;
  trust_score: number;
  no_shows: number;
  no_pickups: number;
  late_cancellations: number;
  confirmed_no_response: number;
  total_bookings: number;
  completed_bookings: number;
  on_time_pickups: number;
  is_vip: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Booking Confirmation Record
 */
export interface BookingConfirmation {
  id: string;
  tenant_id: string;
  branch_id: string;
  confirmation_type: 'voice_to_message' | 'reminder_24h' | 'reminder_2h' | 'deposit_required' | 'custom';
  appointment_id: string | null;
  order_id: string | null;
  customer_phone: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'responded' | 'expired' | 'failed';
  customer_response: 'confirmed' | 'cancelled' | 'need_change' | 'other' | null;
  sent_via: 'whatsapp' | 'sms' | 'email' | null;
  auto_action_on_expire: 'cancel' | 'keep' | 'notify_staff';
  auto_action_executed: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Appointment with Secure Booking fields
 */
export interface AppointmentWithBookingState {
  id: string;
  tenant_id: string;
  branch_id: string;
  lead_id: string;
  staff_id: string | null;
  service_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  confirmation_status: ConfirmationStatus | null;
  deposit_status: DepositStatus | null;
  deposit_amount_cents: number | null;
  customer_trust_score_at_booking: number | null;
  created_from_hold_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations (when joined)
  leads?: {
    full_name: string | null;
    phone: string | null;
  };
  services?: {
    name: string;
  };
  staff?: {
    full_name: string;
  };
  branches?: {
    name: string;
  };
  booking_holds?: BookingHold;
}

/**
 * Calendar Tab Type for the reservation/calendar page
 */
export type CalendarTabKey = 'agenda' | 'estados';

/**
 * Booking state filter options for Estados tab
 */
export interface BookingStateFilters {
  status?: string[];
  confirmationStatus?: ConfirmationStatus[];
  depositStatus?: DepositStatus[];
  trustLevel?: TrustLevel[];
  dateFrom?: string;
  dateTo?: string;
  hasActiveHold?: boolean;
}

/**
 * Aggregated booking statistics for Estados tab
 */
export interface BookingStateStats {
  totalBookings: number;
  pendingConfirmation: number;
  pendingDeposit: number;
  confirmed: number;
  activeHolds: number;
  noShows: number;
  cancelled: number;
  completed: number;
}

/**
 * Props for booking state indicator component
 */
export interface BookingStateIndicatorProps {
  appointmentStatus: string;
  confirmationStatus?: ConfirmationStatus | null;
  depositStatus?: DepositStatus | null;
  trustScore?: number | null;
  hasActiveHold?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * Utility function to get trust level from score
 */
export function getTrustLevelFromScore(score: number): TrustLevel {
  if (score >= 80) return 'trusted';
  if (score >= 50) return 'standard';
  if (score >= 30) return 'cautious';
  return 'high_risk';
}

/**
 * Utility function to determine combined booking state
 */
export function getCombinedBookingState(
  appointmentStatus: string,
  confirmationStatus?: ConfirmationStatus | null,
  depositStatus?: DepositStatus | null,
  hasActiveHold?: boolean
): BookingCombinedState {
  if (hasActiveHold) return 'hold_active';
  if (depositStatus === 'required' || depositStatus === 'pending') return 'pending_deposit';
  if (confirmationStatus === 'pending') return 'pending_confirmation';

  switch (appointmentStatus) {
    case 'confirmed':
      return 'confirmed';
    case 'scheduled':
      return 'scheduled';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'no_show':
      return 'no_show';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'scheduled';
  }
}
