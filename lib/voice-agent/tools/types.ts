/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool System Types
 *
 * Defines all types and interfaces for the unified tool system.
 * Tools are reusable across voice and chat channels.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// =====================================================
// TOOL DEFINITION TYPES
// =====================================================

/**
 * JSON Schema for tool parameters
 */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description?: string;
  format?: 'date' | 'date-time' | 'time' | 'email' | 'uri';
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Tool capabilities that can be enabled/disabled per assistant type
 */
export type ToolCapability =
  | 'reservations'
  | 'appointments'
  | 'orders'
  | 'menu'
  | 'services'
  | 'hours'
  | 'location'
  | 'pricing'
  | 'human_transfer'
  | 'transfers'
  | 'order_status';

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | 'booking'
  | 'appointment'
  | 'info'
  | 'order'
  | 'escalation'
  | 'transfer'
  | 'call'
  | 'utility';

/**
 * Assistant types that a tool can be enabled for
 */
export type AssistantTypeId =
  | 'rest_basic'
  | 'rest_standard'
  | 'rest_complete'
  | 'dental_basic'
  | 'dental_standard'
  | 'dental_complete'
  | '*'; // All types

// =====================================================
// TOOL CONTEXT
// =====================================================

/**
 * Context passed to tool handlers
 */
export interface ToolContext {
  /** Tenant/business ID */
  tenantId: string;

  /** Branch ID (if multi-branch) */
  branchId?: string;

  /** Call ID (for voice) */
  callId: string;

  /** VAPI call ID (for voice) */
  vapiCallId?: string;

  /** Voice config ID */
  voiceConfigId?: string;

  /** Assistant type being used */
  assistantType: string;

  /** Language/locale */
  locale: string;

  /** Channel (voice or whatsapp) */
  channel: 'voice' | 'whatsapp' | 'chat';

  /** Supabase client */
  supabase: SupabaseClient;

  /** Extracted entities from user input */
  entities: Record<string, unknown>;

  /** Conversation history summary (for context) */
  conversationSummary?: string;
}

// =====================================================
// TOOL RESULT
// =====================================================

/**
 * Result from tool execution
 */
export interface ToolResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data if successful */
  data?: Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Error code for categorization */
  errorCode?: string;

  /** Voice-optimized message for the result */
  voiceMessage: string;

  /** Whether to forward result to client (for VAPI) */
  forwardToClient?: boolean;

  /** Whether to end the call (for end_call tool) */
  endCall?: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result specifically for booking operations
 */
export interface BookingResult extends ToolResult {
  data?: {
    reservationId?: string;
    appointmentId?: string;
    confirmationCode?: string;
    dateTime?: string;
    estimatedDuration?: number;
  };
}

/**
 * Result specifically for order operations
 */
export interface OrderResult extends ToolResult {
  data?: {
    orderId?: string;
    orderNumber?: string;
    total?: number;
    estimatedTime?: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
  };
}

/**
 * Result specifically for availability checks
 */
export interface AvailabilityResult extends ToolResult {
  data?: {
    available: boolean;
    date?: string;
    requestedTime?: string;
    requestedSlot?: { date: string; time: string };
    alternativeSlots?: string[];
    nextAvailable?: string;
    slots?: Array<{
      time: string;
      doctorId?: string;
      doctorName?: string;
      available?: boolean;
    }>;
  };
}

/**
 * Result specifically for transfer operations
 */
export interface TransferResult extends ToolResult {
  data?: {
    shouldTransfer: boolean;
    transferNumber?: string;
    reason?: string;
    queuePosition?: number;
    estimatedWait?: number;
  };
}

// =====================================================
// TOOL HANDLER
// =====================================================

/**
 * Tool handler function type
 */
export type ToolHandler<TParams = Record<string, unknown>, TResult = ToolResult> = (
  params: TParams,
  context: ToolContext
) => Promise<TResult>;

// =====================================================
// TOOL DEFINITION
// =====================================================

/**
 * Complete tool definition
 */
export interface ToolDefinition<TParams = Record<string, unknown>> {
  /** Unique tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool category */
  category: ToolCategory;

  /** JSON Schema for parameters */
  parameters: JSONSchema;

  /** Required capabilities to use this tool */
  requiredCapabilities: ToolCapability[];

  /** Whether this tool requires user confirmation before execution */
  requiresConfirmation: boolean;

  /** Template for confirmation message (with {param} placeholders) */
  confirmationTemplate?: string;

  /** Function to generate dynamic confirmation message */
  confirmationMessage?: (params: TParams) => string;

  /** Assistant types this tool is enabled for */
  enabledFor: AssistantTypeId[];

  /** The handler function */
  handler: ToolHandler<TParams>;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to log detailed execution info */
  logDetails?: boolean;
}

// =====================================================
// TOOL REGISTRY TYPES
// =====================================================

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  /** Register a tool */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(tool: ToolDefinition<any>): void;

  /** Get tool by name */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): ToolDefinition<any> | undefined;

  /** Check if tool exists */
  has(name: string): boolean;

  /** Get tools for a specific assistant type */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getForType(assistantType: string): ToolDefinition<any>[];

  /** Get tools by category */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByCategory(category: ToolCategory): ToolDefinition<any>[];

  /** Check if tool requires confirmation */
  requiresConfirmation(name: string): boolean;

  /** Get confirmation message for a tool */
  getConfirmationMessage(name: string, params: Record<string, unknown>): string | null;

  /** Execute a tool */
  execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult>;

  /** Get all registered tool names */
  getToolNames(): string[];

  /** Get tools as VAPI function definitions */
  getVAPIFunctions(assistantType: string): VAPIFunctionDefinition[];
}

// =====================================================
// VAPI INTEGRATION TYPES
// =====================================================

/**
 * VAPI function definition format
 */
export interface VAPIFunctionDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
}

/**
 * VAPI tool call format
 */
export interface VAPIToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// =====================================================
// TOOL EXECUTION TYPES
// =====================================================

/**
 * Tool execution log entry
 */
export interface ToolExecutionLog {
  /** Tool name */
  toolName: string;

  /** Tenant ID */
  tenantId: string;

  /** Call ID */
  callId: string;

  /** Parameters used */
  parameters: Record<string, unknown>;

  /** Result */
  result: ToolResult;

  /** Execution time in ms */
  durationMs: number;

  /** Timestamp */
  timestamp: Date;

  /** Whether it was successful */
  success: boolean;

  /** Error if any */
  error?: string;
}

/**
 * Tool metrics for analytics
 */
export interface ToolMetrics {
  toolName: string;
  totalExecutions: number;
  successRate: number;
  averageDurationMs: number;
  lastExecuted?: Date;
  errorCounts: Record<string, number>;
}

// =====================================================
// PARAMETER TYPES FOR SPECIFIC TOOLS
// =====================================================

/**
 * Parameters for check_availability tool
 */
export interface CheckAvailabilityParams {
  date: string;
  time?: string;
  partySize?: number;
  durationMinutes?: number;
  serviceId?: string;
  serviceType?: string;
  staffId?: string;
  doctorId?: string;
  specialty?: string;
}

/**
 * Parameters for create_reservation tool
 */
export interface CreateReservationParams {
  date: string;
  time: string;
  partySize: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  specialRequests?: string;
}

/**
 * Parameters for create_appointment tool
 */
export interface CreateAppointmentParams {
  date: string;
  time: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  serviceId?: string;
  serviceType?: string;
  staffId?: string;
  doctorId?: string;
  reason?: string;
  notes?: string;
  isFirstVisit?: boolean;
  isEmergency?: boolean;
}

/**
 * Parameters for modify_reservation/appointment tool
 */
export interface ModifyBookingParams {
  bookingId?: string;
  confirmationCode?: string;
  customerPhone?: string;
  newDate?: string;
  newTime?: string;
  newPartySize?: number;
  newSpecialRequests?: string;
}

/**
 * Parameters for cancel_reservation/appointment tool
 */
export interface CancelBookingParams {
  bookingId?: string;
  confirmationCode?: string;
  customerPhone?: string;
  reason?: string;
}

/**
 * Parameters for get_menu tool
 */
export interface GetMenuParams {
  category?: string;
  searchTerm?: string;
  includePrices?: boolean;
  limit?: number;
}

/**
 * Parameters for create_order tool
 */
export interface CreateOrderParams {
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifications?: string;
  }>;
  deliveryType: 'delivery' | 'pickup';
  deliveryAddress?: string;
  customerName: string;
  customerPhone: string;
  specialInstructions?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
}

/**
 * Parameters for get_services tool
 */
export interface GetServicesParams {
  category?: string;
  specialty?: string;
  includePrices?: boolean;
  includeDuration?: boolean;
  staffId?: string;
}

/**
 * Parameters for get_business_hours tool
 */
export interface GetBusinessHoursParams {
  branchId?: string;
  day?: string;
  includeHolidays?: boolean;
}

/**
 * Parameters for transfer_to_human tool
 */
export interface TransferToHumanParams {
  reason: string;
  urgency?: 'low' | 'medium' | 'high';
  contextSummary?: string;
  preferredAgent?: string;
  department?: 'general' | 'sales' | 'support' | 'billing' | 'manager';
  priority?: 'normal' | 'high' | 'urgent';
  context?: string;
}

/**
 * Parameters for modify_reservation tool
 */
export interface ModifyReservationParams {
  confirmationCode: string;
  customerPhone: string;
  newDate?: string;
  newTime?: string;
  newPartySize?: number;
  newSpecialRequests?: string;
}

/**
 * Parameters for cancel_reservation tool
 */
export interface CancelReservationParams {
  confirmationCode: string;
  customerPhone: string;
  reason?: string;
}

/**
 * Parameters for modify_appointment tool
 */
export interface ModifyAppointmentParams {
  confirmationCode: string;
  patientPhone: string;
  newDate?: string;
  newTime?: string;
  newDoctorId?: string;
}

/**
 * Parameters for cancel_appointment tool
 */
export interface CancelAppointmentParams {
  confirmationCode: string;
  patientPhone: string;
  reason?: string;
}

/**
 * Parameters for end_call tool
 */
export interface EndCallParams {
  reason?: 'completed' | 'user_request' | 'error' | 'transferred';
  summary?: string;
}

/**
 * Result for reservation operations
 */
export interface ReservationResult extends ToolResult {
  data?: {
    reservationId?: string;
    confirmationCode?: string;
    date?: string;
    time?: string;
    partySize?: number;
    customerName?: string;
    cancelled?: boolean;
  };
}

/**
 * Result for appointment operations
 */
export interface AppointmentResult extends ToolResult {
  data?: {
    appointmentId?: string;
    confirmationCode?: string;
    date?: string;
    time?: string;
    endTime?: string;
    doctorId?: string;
    doctorName?: string;
    serviceName?: string;
    cancelled?: boolean;
  };
}

/**
 * Result for menu queries
 */
export interface MenuResult extends ToolResult {
  data?: {
    items?: Array<{
      id: string;
      name: string;
      description?: string;
      price?: number;
      category?: string;
    }>;
    categories?: string[];
  };
}

/**
 * Result for services queries
 */
export interface ServicesResult extends ToolResult {
  data?: {
    services?: Array<{
      name: string;
      description: string;
      category: string;
      duration?: number;
      priceRange?: string;
    }>;
    categories?: string[];
  };
}

// =====================================================
// VALIDATION TYPES
// =====================================================

/**
 * Parameter validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Individual validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: 'required' | 'type' | 'format' | 'range' | 'enum' | 'custom';
}

/**
 * Parameter validator function
 */
export type ParameterValidator = (
  params: Record<string, unknown>,
  schema: JSONSchema
) => ValidationResult;
