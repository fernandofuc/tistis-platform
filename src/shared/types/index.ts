// =====================================================
// TIS TIS PLATFORM - Shared Types Index
// =====================================================

export * from './database';

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
