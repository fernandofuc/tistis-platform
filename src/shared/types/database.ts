// =====================================================
// TIS TIS PLATFORM - Database Types (from Supabase Schema v2)
// Auto-generated types matching 003_esva_schema_v2.sql
// =====================================================

// ======================
// ENUMS
// ======================
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'appointment_scheduled' | 'converted' | 'lost' | 'inactive';
export type LeadClassification = 'hot' | 'warm' | 'cold';
export type LeadSource = 'whatsapp' | 'instagram' | 'facebook' | 'website' | 'referral' | 'walk_in' | 'phone' | 'other';
export type ConversationStatus = 'active' | 'waiting_response' | 'escalated' | 'resolved' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export type StaffRole = 'owner' | 'admin' | 'specialist' | 'receptionist' | 'assistant';
export type TenantPlan = 'starter' | 'growth' | 'enterprise';
export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'trial';
export type NotificationType = 'hot_lead' | 'new_appointment' | 'cancellation' | 'escalation' | 'reminder' | 'daily_report' | 'weekly_report';
export type ServicePriceUnit = 'per_treatment' | 'per_tooth' | 'per_session' | 'per_hour';

// ======================
// CORE ENTITIES
// ======================
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  vertical: string;
  plan: TenantPlan;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  logo_url: string | null;
  status: TenantStatus;
  settings: TenantSettings | null;
  features_enabled: string[];
  created_at: string;
  updated_at: string;
}

export interface TenantSettings {
  branding?: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string | null;
  };
  ai?: {
    personality?: string;
    response_style?: string;
    max_message_length?: number;
  };
  notifications?: {
    escalation_timeout_minutes?: number;
    daily_report_time?: string;
  };
}

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  branch_code: string | null;
  city: string;
  state: string | null;
  country: string;
  address: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  timezone: string;
  operating_hours: OperatingHours | null;
  google_maps_url: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  appointment_duration_default: number | null;
  advance_booking_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export interface DayHours {
  open: string | null;
  close: string | null;
  enabled: boolean;
}

export interface Staff {
  id: string;
  tenant_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  avatar_url: string | null;
  role: StaffRole;
  role_title: string | null;
  is_active: boolean;
  notification_preferences: NotificationPreferences | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  channels: string[];
  types: {
    hot_leads?: boolean;
    new_appointments?: boolean;
    cancellations?: boolean;
    escalations?: boolean;
    daily_report?: boolean;
    weekly_report?: boolean;
  };
  quiet_hours?: {
    start: string;
    end: string;
    enabled: boolean;
  };
}

export interface StaffBranch {
  id: string;
  staff_id: string;
  branch_id: string;
  is_primary: boolean;
  created_at: string;
}

// ======================
// LEAD MANAGEMENT
// ======================
export interface Lead {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  phone: string;
  phone_normalized: string | null;
  full_name: string | null;
  email: string | null;
  source: LeadSource;
  source_details: Record<string, unknown> | null;
  status: LeadStatus;
  classification: LeadClassification;
  score: number;
  interested_services: string[];
  preferred_branch_id: string | null;
  preferred_contact_time: string | null;
  notes: string | null;
  tags: string[];
  assigned_staff_id: string | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadWithDetails extends Lead {
  branch?: Branch;
  assigned_staff?: Staff;
  dental_profile?: LeadDentalProfile;
  conversations?: Conversation[];
  appointments?: Appointment[];
}

export interface LeadDentalProfile {
  id: string;
  lead_id: string;
  primary_concern: string | null;
  current_pain_level: number | null;
  has_dental_insurance: boolean | null;
  insurance_provider: string | null;
  previous_dental_work: string[];
  allergies: string[];
  medical_conditions: string[];
  medications: string[];
  is_from_usa: boolean;
  usa_state: string | null;
  travel_flexibility: string | null;
  budget_range: string | null;
  decision_timeline: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadScoringHistory {
  id: string;
  lead_id: string;
  previous_score: number;
  new_score: number;
  change_reason: string;
  triggered_by: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ======================
// CONVERSATIONS
// ======================
export interface Conversation {
  id: string;
  tenant_id: string;
  lead_id: string;
  branch_id: string | null;
  channel: string;
  channel_conversation_id: string | null;
  status: ConversationStatus;
  current_intent: string | null;
  context: ConversationContext | null;
  ai_handling: boolean;
  escalated_at: string | null;
  escalated_to_staff_id: string | null;
  escalation_reason: string | null;
  resolved_at: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationContext {
  last_intent?: string;
  topics_discussed?: string[];
  services_mentioned?: string[];
  appointment_context?: {
    proposed_date?: string;
    proposed_time?: string;
    service?: string;
  };
  [key: string]: unknown;
}

export interface ConversationWithDetails extends Conversation {
  lead?: Lead;
  branch?: Branch;
  messages?: Message[];
  escalated_to?: Staff;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  channel_message_id: string | null;
  metadata: MessageMetadata | null;
  created_at: string;
}

export interface MessageMetadata {
  intent?: string;
  confidence?: number;
  entities?: Record<string, unknown>;
  response_time_ms?: number;
  model_used?: string;
  [key: string]: unknown;
}

// ======================
// APPOINTMENTS
// ======================
export interface Appointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  lead_id: string;
  staff_id: string | null;
  service_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  confirmation_sent: boolean;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  reason: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  rescheduled_from_id: string | null;
  created_by_staff_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithDetails extends Appointment {
  branch?: Branch;
  lead?: Lead;
  staff?: Staff;
  service?: Service;
  dental_details?: AppointmentDentalDetails;
}

export interface AppointmentDentalDetails {
  id: string;
  appointment_id: string;
  treatment_plan_id: string | null;
  teeth_involved: string[];
  procedure_notes: string | null;
  materials_used: string[];
  lab_work_required: boolean;
  lab_work_status: string | null;
  follow_up_required: boolean;
  follow_up_notes: string | null;
  photos_before: string[];
  photos_after: string[];
  created_at: string;
  updated_at: string;
}

// ======================
// SERVICES
// ======================
export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  short_description: string | null;
  category: string | null;
  subcategory: string | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: ServicePriceUnit;
  currency: string;
  price_variants: PriceVariant[];
  duration_minutes: number | null;
  sessions_required: number | null;
  requires_consultation: boolean;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  keywords: string[];
  ai_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceVariant {
  name: string;
  price: number;
  currency: string;
  description?: string;
}

// ======================
// QUOTES
// ======================
export interface Quote {
  id: string;
  tenant_id: string;
  lead_id: string;
  branch_id: string | null;
  staff_id: string | null;
  quote_number: string;
  status: string;
  items: QuoteItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: string | null;
  discount_reason: string | null;
  tax_amount: number;
  total: number;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  service_id?: string;
  service_name: string;
  variant?: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string;
}

// ======================
// FAQs & AI CONFIG
// ======================
export interface FAQ {
  id: string;
  tenant_id: string;
  question: string;
  answer: string;
  short_answer: string | null;
  category: string | null;
  keywords: string[];
  question_variations: string[];
  language: string;
  is_active: boolean;
  display_order: number;
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIConfig {
  id: string;
  tenant_id: string;
  config_key: string;
  config_value: unknown;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ======================
// NOTIFICATIONS & ANALYTICS
// ======================
export interface NotificationLog {
  id: string;
  tenant_id: string;
  type: NotificationType;
  recipient_staff_id: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  channel: string;
  subject: string | null;
  content: string;
  related_lead_id: string | null;
  related_appointment_id: string | null;
  related_conversation_id: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AnalyticsDaily {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  date: string;
  new_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  conversations_started: number;
  conversations_resolved: number;
  escalations: number;
  appointments_scheduled: number;
  appointments_completed: number;
  appointments_cancelled: number;
  appointments_no_show: number;
  quotes_sent: number;
  quotes_accepted: number;
  revenue: number;
  avg_response_time_seconds: number | null;
  avg_lead_score: number | null;
  conversion_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by_user_id: string | null;
  changed_by_staff_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ======================
// VIEW TYPES
// ======================
export interface ActiveLead {
  id: string;
  tenant_id: string;
  phone: string;
  name: string | null;
  classification: LeadClassification;
  score: number;
  status: LeadStatus;
  source: LeadSource;
  interested_services: string[];
  branch_name: string | null;
  assigned_staff_name: string | null;
  last_contact_at: string | null;
  created_at: string;
}

export interface TodayAppointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  branch_name: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string;
  staff_name: string | null;
  service_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
}

export interface DailyMetrics {
  tenant_id: string;
  branch_id: string | null;
  date: string;
  new_leads: number;
  hot_leads: number;
  appointments_scheduled: number;
  appointments_completed: number;
  escalations: number;
  avg_response_time_seconds: number | null;
}
