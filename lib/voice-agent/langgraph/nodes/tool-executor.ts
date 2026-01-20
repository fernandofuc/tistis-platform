/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool Executor Node
 *
 * Executes tools/functions requested by the voice agent.
 * Handles:
 * - Tool registry lookup
 * - Confirmation workflow
 * - Circuit breaker integration
 * - Voice-optimized result formatting
 *
 * Flow:
 * 1. Get tool from registry
 * 2. Check if requires confirmation
 * 3. If requires and not confirmed: go to confirmation node
 * 4. If not required or already confirmed: execute
 * 5. Format result for voice
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { VoiceAgentState, ToolExecutionResult, PendingTool } from '../state';
import { recordLatency, addError, requiresConfirmation } from '../state';

// =====================================================
// TYPES
// =====================================================

/**
 * Tool executor configuration
 */
export interface ToolExecutorConfig {
  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;

  /** Custom tool registry */
  toolRegistry?: ToolRegistry;

  /** Default locale for messages */
  locale?: string;

  /** Whether to use circuit breaker */
  useCircuitBreaker?: boolean;

  /** Timeout for tool execution in ms */
  executionTimeout?: number;
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Whether tool requires user confirmation */
  requiresConfirmation: boolean;

  /** Tool executor function */
  execute: (
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<ToolExecutionResult>;

  /** Message template for confirmation */
  confirmationTemplate?: string;

  /** Parameters schema (for validation) */
  parameters?: Record<string, ParameterDefinition>;
}

/**
 * Parameter definition for tool
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'object' | 'array';
  required?: boolean;
  description?: string;
  default?: unknown;
}

/**
 * Context passed to tool executors
 */
export interface ToolExecutionContext {
  tenantId: string;
  callId: string;
  vapiCallId: string;
  locale: string;
  supabase: SupabaseClient;
  entities: Record<string, unknown>;
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  get(name: string): ToolDefinition | undefined;
  has(name: string): boolean;
  list(): string[];
}

// =====================================================
// DEFAULT TOOL REGISTRY
// =====================================================

/**
 * Default tool implementations
 */
const defaultTools: Record<string, ToolDefinition> = {
  // ==================
  // Information Tools
  // ==================
  get_business_hours: {
    name: 'get_business_hours',
    description: 'Get business operating hours',
    requiresConfirmation: false,
    async execute(params, context) {
      try {
        const { data } = await context.supabase
          .from('business_knowledge')
          .select('content')
          .eq('tenant_id', context.tenantId)
          .eq('category', 'hours')
          .eq('active', true)
          .single();

        if (!data?.content) {
          return {
            success: true,
            data: null,
            voiceMessage: context.locale === 'en'
              ? 'I don\'t have the business hours information available right now.'
              : 'No tengo la información del horario disponible en este momento.',
          };
        }

        return {
          success: true,
          data: { hours: data.content },
          voiceMessage: data.content,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to retrieve business hours',
          voiceMessage: context.locale === 'en'
            ? 'I couldn\'t retrieve the business hours. Please try again.'
            : 'No pude obtener el horario. Por favor intente de nuevo.',
        };
      }
    },
  },

  get_business_info: {
    name: 'get_business_info',
    description: 'Get general business information',
    requiresConfirmation: false,
    async execute(params, context) {
      try {
        const { data } = await context.supabase
          .from('tenants')
          .select('name, settings')
          .eq('id', context.tenantId)
          .single();

        if (!data) {
          return {
            success: true,
            data: null,
            voiceMessage: context.locale === 'en'
              ? 'Business information is not available.'
              : 'La información del negocio no está disponible.',
          };
        }

        return {
          success: true,
          data: { name: data.name, settings: data.settings },
          voiceMessage: context.locale === 'en'
            ? `You're speaking with ${data.name}. How can I help you?`
            : `Está hablando con ${data.name}. ¿En qué puedo ayudarle?`,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to retrieve business info',
          voiceMessage: context.locale === 'en'
            ? 'I couldn\'t retrieve the business information.'
            : 'No pude obtener la información del negocio.',
        };
      }
    },
  },

  get_menu: {
    name: 'get_menu',
    description: 'Get menu or services information',
    requiresConfirmation: false,
    async execute(params, context) {
      try {
        const { data } = await context.supabase
          .from('business_knowledge')
          .select('content')
          .eq('tenant_id', context.tenantId)
          .in('category', ['menu', 'services'])
          .eq('active', true)
          .limit(5);

        if (!data || data.length === 0) {
          return {
            success: true,
            data: null,
            voiceMessage: context.locale === 'en'
              ? 'Menu information is not available at the moment.'
              : 'La información del menú no está disponible en este momento.',
          };
        }

        const menuContent = data.map((d: { content: string }) => d.content).join('. ');
        return {
          success: true,
          data: { menu: menuContent },
          voiceMessage: menuContent,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to retrieve menu',
          voiceMessage: context.locale === 'en'
            ? 'I couldn\'t retrieve the menu information.'
            : 'No pude obtener la información del menú.',
        };
      }
    },
  },

  get_location: {
    name: 'get_location',
    description: 'Get business location and directions',
    requiresConfirmation: false,
    async execute(params, context) {
      try {
        const { data } = await context.supabase
          .from('business_knowledge')
          .select('content')
          .eq('tenant_id', context.tenantId)
          .eq('category', 'location')
          .eq('active', true)
          .single();

        if (!data?.content) {
          return {
            success: true,
            data: null,
            voiceMessage: context.locale === 'en'
              ? 'Location information is not available.'
              : 'La información de ubicación no está disponible.',
          };
        }

        return {
          success: true,
          data: { location: data.content },
          voiceMessage: data.content,
        };
      } catch {
        return {
          success: false,
          error: 'Failed to retrieve location',
          voiceMessage: context.locale === 'en'
            ? 'I couldn\'t retrieve the location information.'
            : 'No pude obtener la información de ubicación.',
        };
      }
    },
  },

  // ==================
  // Reservation Tools
  // ==================
  check_availability: {
    name: 'check_availability',
    description: 'Check availability for a reservation',
    requiresConfirmation: false,
    parameters: {
      date: { type: 'date', required: true, description: 'Date for reservation' },
      time: { type: 'time', required: false, description: 'Preferred time' },
      guests: { type: 'number', required: false, description: 'Number of guests' },
    },
    async execute(params, context) {
      const date = params.date as string || context.entities.date as string;
      const time = params.time as string || context.entities.time as string;
      const guests = params.guests as number || context.entities.quantity as number || 2;

      if (!date) {
        return {
          success: true,
          data: { needsInfo: true, missing: 'date' },
          voiceMessage: context.locale === 'en'
            ? 'For what date would you like to check availability?'
            : '¿Para qué fecha desea verificar la disponibilidad?',
        };
      }

      // Simulate availability check
      const isAvailable = Math.random() > 0.2; // 80% availability for demo
      const availableTimes = ['12:00', '13:00', '14:00', '18:00', '19:00', '20:00'];

      if (isAvailable) {
        const timeStr = time || availableTimes[Math.floor(Math.random() * availableTimes.length)];
        return {
          success: true,
          data: { available: true, date, time: timeStr, guests },
          voiceMessage: context.locale === 'en'
            ? `Yes, we have availability for ${guests} guests on ${date}. Would you like me to make a reservation?`
            : `Sí, tenemos disponibilidad para ${guests} personas el ${date}. ¿Desea que haga la reservación?`,
        };
      }

      return {
        success: true,
        data: { available: false, date, suggestedTimes: availableTimes },
        voiceMessage: context.locale === 'en'
          ? `Unfortunately, we don't have availability at that time on ${date}. We have openings at ${availableTimes.slice(0, 3).join(', ')}.`
          : `Desafortunadamente no tenemos disponibilidad a esa hora el ${date}. Tenemos espacios a las ${availableTimes.slice(0, 3).join(', ')}.`,
      };
    },
  },

  create_reservation: {
    name: 'create_reservation',
    description: 'Create a new reservation',
    requiresConfirmation: true,
    confirmationTemplate: 'es' === 'es'
      ? '¿Confirma la reservación para {guests} personas el {date} a las {time}?'
      : 'Confirm reservation for {guests} guests on {date} at {time}?',
    parameters: {
      date: { type: 'date', required: true, description: 'Reservation date' },
      time: { type: 'time', required: true, description: 'Reservation time' },
      guests: { type: 'number', required: true, description: 'Number of guests' },
      name: { type: 'string', required: true, description: 'Name for reservation' },
      phone: { type: 'string', required: false, description: 'Contact phone' },
    },
    async execute(params, context) {
      const date = params.date as string || context.entities.date as string;
      const time = params.time as string || context.entities.time as string;
      const guests = params.guests as number || context.entities.quantity as number || 2;
      const name = params.name as string || context.entities.name as string;

      // Check for required fields
      const missing: string[] = [];
      if (!date) missing.push('date');
      if (!time) missing.push('time');
      if (!name) missing.push('name');

      if (missing.length > 0) {
        const missingStr = missing.join(', ');
        return {
          success: true,
          data: { needsInfo: true, missing },
          voiceMessage: context.locale === 'en'
            ? `I need a few more details: ${missingStr}. Could you provide that?`
            : `Necesito algunos datos más: ${missingStr}. ¿Me los puede proporcionar?`,
        };
      }

      try {
        // Create reservation in database
        const reservationId = `RES-${Date.now().toString(36).toUpperCase()}`;

        const { error } = await context.supabase
          .from('reservations')
          .insert({
            id: reservationId,
            tenant_id: context.tenantId,
            call_id: context.callId,
            date,
            time,
            guests,
            name,
            phone: params.phone as string || context.entities.phone as string,
            status: 'confirmed',
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('[ToolExecutor] Reservation creation error:', error);
          return {
            success: false,
            error: error.message,
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t create the reservation. Please try again.'
              : 'No pude crear la reservación. Por favor intente de nuevo.',
          };
        }

        return {
          success: true,
          data: { reservationId, date, time, guests, name },
          voiceMessage: context.locale === 'en'
            ? `Your reservation is confirmed. Reservation number ${reservationId} for ${guests} guests on ${date} at ${time} under the name ${name}.`
            : `Su reservación está confirmada. Número de reservación ${reservationId} para ${guests} personas el ${date} a las ${time} a nombre de ${name}.`,
          forwardToClient: true,
        };
      } catch {
        return {
          success: false,
          error: 'Database error',
          voiceMessage: context.locale === 'en'
            ? 'There was an error creating your reservation. Please try again.'
            : 'Hubo un error al crear su reservación. Por favor intente de nuevo.',
        };
      }
    },
  },

  cancel_reservation: {
    name: 'cancel_reservation',
    description: 'Cancel an existing reservation',
    requiresConfirmation: true,
    confirmationTemplate: '¿Está seguro que desea cancelar la reservación?',
    parameters: {
      reservationId: { type: 'string', required: false, description: 'Reservation ID' },
      phone: { type: 'string', required: false, description: 'Phone used for reservation' },
    },
    async execute(params, context) {
      const reservationId = params.reservationId as string;
      const phone = params.phone as string || context.entities.phone as string;

      if (!reservationId && !phone) {
        return {
          success: true,
          data: { needsInfo: true, missing: ['reservationId', 'phone'] },
          voiceMessage: context.locale === 'en'
            ? 'To cancel a reservation, I need either your reservation number or the phone number used.'
            : 'Para cancelar una reservación, necesito su número de reservación o el teléfono que utilizó.',
        };
      }

      try {
        // Find the reservation
        let query = context.supabase
          .from('reservations')
          .select('*')
          .eq('tenant_id', context.tenantId)
          .eq('status', 'confirmed');

        if (reservationId) {
          query = query.eq('id', reservationId);
        } else if (phone) {
          query = query.eq('phone', phone);
        }

        const { data: reservation, error: findError } = await query.single();

        if (findError || !reservation) {
          return {
            success: true,
            data: { found: false },
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t find a reservation with that information.'
              : 'No encontré una reservación con esa información.',
          };
        }

        // Cancel the reservation
        const { error: updateError } = await context.supabase
          .from('reservations')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', reservation.id);

        if (updateError) {
          return {
            success: false,
            error: updateError.message,
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t cancel the reservation. Please try again.'
              : 'No pude cancelar la reservación. Por favor intente de nuevo.',
          };
        }

        return {
          success: true,
          data: { cancelled: true, reservationId: reservation.id },
          voiceMessage: context.locale === 'en'
            ? `Your reservation for ${reservation.date} has been cancelled.`
            : `Su reservación para el ${reservation.date} ha sido cancelada.`,
          forwardToClient: true,
        };
      } catch {
        return {
          success: false,
          error: 'Database error',
          voiceMessage: context.locale === 'en'
            ? 'There was an error cancelling your reservation.'
            : 'Hubo un error al cancelar su reservación.',
        };
      }
    },
  },

  modify_reservation: {
    name: 'modify_reservation',
    description: 'Modify an existing reservation',
    requiresConfirmation: true,
    confirmationTemplate: '¿Confirma el cambio de la reservación?',
    parameters: {
      reservationId: { type: 'string', required: false, description: 'Reservation ID' },
      newDate: { type: 'date', required: false, description: 'New date' },
      newTime: { type: 'time', required: false, description: 'New time' },
      newGuests: { type: 'number', required: false, description: 'New number of guests' },
    },
    async execute(params, context) {
      const reservationId = params.reservationId as string;

      if (!reservationId) {
        return {
          success: true,
          data: { needsInfo: true, missing: ['reservationId'] },
          voiceMessage: context.locale === 'en'
            ? 'What is your reservation number?'
            : '¿Cuál es su número de reservación?',
        };
      }

      const updates: Record<string, unknown> = {};
      if (params.newDate) updates.date = params.newDate;
      if (params.newTime) updates.time = params.newTime;
      if (params.newGuests) updates.guests = params.newGuests;

      if (Object.keys(updates).length === 0) {
        return {
          success: true,
          data: { needsInfo: true, missing: ['changes'] },
          voiceMessage: context.locale === 'en'
            ? 'What would you like to change about your reservation?'
            : '¿Qué desea cambiar de su reservación?',
        };
      }

      try {
        const { error } = await context.supabase
          .from('reservations')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', reservationId)
          .eq('tenant_id', context.tenantId);

        if (error) {
          return {
            success: false,
            error: error.message,
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t modify the reservation.'
              : 'No pude modificar la reservación.',
          };
        }

        return {
          success: true,
          data: { modified: true, reservationId, changes: updates },
          voiceMessage: context.locale === 'en'
            ? 'Your reservation has been updated.'
            : 'Su reservación ha sido actualizada.',
          forwardToClient: true,
        };
      } catch {
        return {
          success: false,
          error: 'Database error',
          voiceMessage: context.locale === 'en'
            ? 'There was an error modifying your reservation.'
            : 'Hubo un error al modificar su reservación.',
        };
      }
    },
  },

  // ==================
  // Transfer Tools
  // ==================
  transfer_to_human: {
    name: 'transfer_to_human',
    description: 'Transfer the call to a human agent',
    requiresConfirmation: true,
    confirmationTemplate: '¿Desea que lo transfiera con un agente humano?',
    async execute(params, context) {
      const reason = params.reason as string || 'User requested';

      // Log the transfer request
      await context.supabase
        .from('voice_call_events')
        .insert({
          call_id: context.callId,
          event_type: 'transfer_requested',
          event_data: { reason },
          created_at: new Date().toISOString(),
        });

      return {
        success: true,
        data: {
          action: 'transfer',
          destination: 'human_agent',
          reason,
        },
        voiceMessage: context.locale === 'en'
          ? 'I\'m transferring you to a human agent. Please hold.'
          : 'Lo estoy transfiriendo con un agente humano. Por favor espere.',
        forwardToClient: true,
      };
    },
  },

  // ==================
  // Appointment Tools (for medical/service businesses)
  // ==================
  create_appointment: {
    name: 'create_appointment',
    description: 'Create a new appointment',
    requiresConfirmation: true,
    confirmationTemplate: '¿Confirma la cita para el {date} a las {time}?',
    parameters: {
      date: { type: 'date', required: true, description: 'Appointment date' },
      time: { type: 'time', required: true, description: 'Appointment time' },
      service: { type: 'string', required: false, description: 'Service type' },
      name: { type: 'string', required: true, description: 'Patient/client name' },
      phone: { type: 'string', required: false, description: 'Contact phone' },
    },
    async execute(params, context) {
      const date = params.date as string || context.entities.date as string;
      const time = params.time as string || context.entities.time as string;
      const name = params.name as string || context.entities.name as string;

      const missing: string[] = [];
      if (!date) missing.push('date');
      if (!time) missing.push('time');
      if (!name) missing.push('name');

      if (missing.length > 0) {
        return {
          success: true,
          data: { needsInfo: true, missing },
          voiceMessage: context.locale === 'en'
            ? `I need some more information to schedule your appointment: ${missing.join(', ')}.`
            : `Necesito más información para agendar su cita: ${missing.join(', ')}.`,
        };
      }

      const appointmentId = `APT-${Date.now().toString(36).toUpperCase()}`;

      try {
        const { error } = await context.supabase
          .from('appointments')
          .insert({
            id: appointmentId,
            tenant_id: context.tenantId,
            call_id: context.callId,
            date,
            time,
            service: params.service as string,
            name,
            phone: params.phone as string || context.entities.phone as string,
            status: 'scheduled',
            created_at: new Date().toISOString(),
          });

        if (error) {
          return {
            success: false,
            error: error.message,
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t schedule the appointment.'
              : 'No pude agendar la cita.',
          };
        }

        return {
          success: true,
          data: { appointmentId, date, time, name },
          voiceMessage: context.locale === 'en'
            ? `Your appointment is scheduled for ${date} at ${time}. Your confirmation number is ${appointmentId}.`
            : `Su cita está agendada para el ${date} a las ${time}. Su número de confirmación es ${appointmentId}.`,
          forwardToClient: true,
        };
      } catch {
        return {
          success: false,
          error: 'Database error',
          voiceMessage: context.locale === 'en'
            ? 'There was an error scheduling your appointment.'
            : 'Hubo un error al agendar su cita.',
        };
      }
    },
  },

  cancel_appointment: {
    name: 'cancel_appointment',
    description: 'Cancel an existing appointment',
    requiresConfirmation: true,
    confirmationTemplate: '¿Está seguro que desea cancelar la cita?',
    parameters: {
      appointmentId: { type: 'string', required: false, description: 'Appointment ID' },
      phone: { type: 'string', required: false, description: 'Phone used for appointment' },
    },
    async execute(params, context) {
      const appointmentId = params.appointmentId as string;
      const phone = params.phone as string || context.entities.phone as string;

      if (!appointmentId && !phone) {
        return {
          success: true,
          data: { needsInfo: true, missing: ['appointmentId', 'phone'] },
          voiceMessage: context.locale === 'en'
            ? 'To cancel an appointment, I need your confirmation number or phone number.'
            : 'Para cancelar una cita, necesito su número de confirmación o teléfono.',
        };
      }

      try {
        let query = context.supabase
          .from('appointments')
          .select('*')
          .eq('tenant_id', context.tenantId)
          .eq('status', 'scheduled');

        if (appointmentId) {
          query = query.eq('id', appointmentId);
        } else if (phone) {
          query = query.eq('phone', phone);
        }

        const { data: appointment, error: findError } = await query.single();

        if (findError || !appointment) {
          return {
            success: true,
            data: { found: false },
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t find an appointment with that information.'
              : 'No encontré una cita con esa información.',
          };
        }

        const { error: updateError } = await context.supabase
          .from('appointments')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', appointment.id);

        if (updateError) {
          return {
            success: false,
            error: updateError.message,
            voiceMessage: context.locale === 'en'
              ? 'I couldn\'t cancel the appointment.'
              : 'No pude cancelar la cita.',
          };
        }

        return {
          success: true,
          data: { cancelled: true, appointmentId: appointment.id },
          voiceMessage: context.locale === 'en'
            ? `Your appointment for ${appointment.date} has been cancelled.`
            : `Su cita para el ${appointment.date} ha sido cancelada.`,
          forwardToClient: true,
        };
      } catch {
        return {
          success: false,
          error: 'Database error',
          voiceMessage: context.locale === 'en'
            ? 'There was an error cancelling your appointment.'
            : 'Hubo un error al cancelar su cita.',
        };
      }
    },
  },
};

/**
 * Default tool registry implementation
 */
class DefaultToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolDefinition>;

  constructor(tools: Record<string, ToolDefinition> = defaultTools) {
    this.tools = new Map(Object.entries(tools));
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

// =====================================================
// TOOL EXECUTOR NODE
// =====================================================

/**
 * Tool Executor node - executes tools/functions
 */
export async function toolExecutorNode(
  state: VoiceAgentState,
  config?: ToolExecutorConfig
): Promise<Partial<VoiceAgentState>> {
  const startTime = Date.now();
  const nodeConfig = {
    locale: config?.locale ?? state.locale ?? 'es',
    useCircuitBreaker: config?.useCircuitBreaker ?? true,
    executionTimeout: config?.executionTimeout ?? 10000,
  };

  const supabase = config?.supabaseClient || createServiceClient();
  const registry = config?.toolRegistry || new DefaultToolRegistry();

  try {
    const pendingTool = state.pendingTool;

    if (!pendingTool) {
      console.warn('[ToolExecutor] No pending tool to execute');
      return {
        ...recordLatency(state, 'tool_executor', startTime),
        currentNode: 'tool_executor',
        toolResult: {
          success: false,
          error: 'No tool specified',
          voiceMessage: nodeConfig.locale === 'en'
            ? 'I\'m not sure what action to perform.'
            : 'No estoy seguro de qué acción realizar.',
        },
      };
    }

    console.log(
      `[ToolExecutor] Executing tool: ${pendingTool.name}`,
      { params: pendingTool.parameters, requiresConfirmation: pendingTool.requiresConfirmation }
    );

    // Get tool from registry
    const tool = registry.get(pendingTool.name);

    if (!tool) {
      console.warn(`[ToolExecutor] Tool not found: ${pendingTool.name}`);
      return {
        ...recordLatency(state, 'tool_executor', startTime),
        currentNode: 'tool_executor',
        toolResult: {
          success: false,
          error: `Tool not found: ${pendingTool.name}`,
          voiceMessage: nodeConfig.locale === 'en'
            ? 'That function is not available.'
            : 'Esa función no está disponible.',
        },
      };
    }

    // Check if confirmation is required and not yet confirmed
    if (tool.requiresConfirmation && state.confirmationStatus !== 'confirmed') {
      // Generate confirmation message
      const confirmationMessage = generateConfirmationMessage(
        tool,
        pendingTool.parameters,
        state.entities,
        nodeConfig.locale
      );

      return {
        ...recordLatency(state, 'tool_executor', startTime),
        currentNode: 'tool_executor',
        pendingTool: {
          ...pendingTool,
          requiresConfirmation: true,
          confirmationMessage,
        },
        confirmationStatus: 'pending',
        response: confirmationMessage,
      };
    }

    // Execute the tool
    const context: ToolExecutionContext = {
      tenantId: state.tenantId,
      callId: state.callId,
      vapiCallId: state.vapiCallId,
      locale: nodeConfig.locale,
      supabase,
      entities: state.entities,
    };

    // Execute with timeout
    const toolResult = await executeWithTimeout(
      tool.execute(pendingTool.parameters, context),
      nodeConfig.executionTimeout
    );

    console.log(
      `[ToolExecutor] Tool result: ${toolResult.success ? 'success' : 'failed'}`,
      { latencyMs: Date.now() - startTime }
    );

    // Log tool execution
    await logToolExecution(supabase, state.callId, pendingTool, toolResult);

    return {
      ...recordLatency(state, 'tool_executor', startTime),
      currentNode: 'tool_executor',
      toolResult,
      pendingTool: undefined, // Clear pending tool after execution
      confirmationStatus: 'none', // Reset confirmation status
    };
  } catch (error) {
    console.error('[ToolExecutor] Error:', error);

    return {
      ...addError(state, 'tool_executor', error instanceof Error ? error.message : 'Unknown error', true),
      ...recordLatency(state, 'tool_executor', startTime),
      currentNode: 'tool_executor',
      toolResult: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: nodeConfig.locale === 'en'
          ? 'There was an error processing your request. Please try again.'
          : 'Hubo un error al procesar su solicitud. Por favor intente de nuevo.',
      },
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Generate confirmation message for tool
 */
function generateConfirmationMessage(
  tool: ToolDefinition,
  params: Record<string, unknown>,
  entities: Record<string, unknown>,
  locale: string
): string {
  if (tool.confirmationTemplate) {
    let message = tool.confirmationTemplate;

    // Replace placeholders with actual values
    const allParams = { ...entities, ...params };
    for (const [key, value] of Object.entries(allParams)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    return message;
  }

  // Default confirmation messages
  const defaultMessages: Record<string, Record<string, string>> = {
    create_reservation: {
      es: '¿Confirma la reservación?',
      en: 'Do you confirm the reservation?',
    },
    cancel_reservation: {
      es: '¿Está seguro que desea cancelar la reservación?',
      en: 'Are you sure you want to cancel the reservation?',
    },
    create_appointment: {
      es: '¿Confirma la cita?',
      en: 'Do you confirm the appointment?',
    },
    cancel_appointment: {
      es: '¿Está seguro que desea cancelar la cita?',
      en: 'Are you sure you want to cancel the appointment?',
    },
    transfer_to_human: {
      es: '¿Desea que lo transfiera con un agente humano?',
      en: 'Would you like me to transfer you to a human agent?',
    },
  };

  const langMessages = defaultMessages[tool.name];
  if (langMessages) {
    return langMessages[locale] || langMessages['es'];
  }

  return locale === 'en'
    ? 'Do you want me to proceed with this action?'
    : '¿Desea que proceda con esta acción?';
}

/**
 * Execute tool with timeout
 * Note: Properly clears the timeout to prevent memory leaks
 */
async function executeWithTimeout(
  promise: Promise<ToolExecutionResult>,
  timeoutMs: number
): Promise<ToolExecutionResult> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tool execution timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Log tool execution for analytics
 */
async function logToolExecution(
  supabase: SupabaseClient,
  callId: string,
  tool: PendingTool,
  result: ToolExecutionResult
): Promise<void> {
  try {
    await supabase
      .from('voice_call_events')
      .insert({
        call_id: callId,
        event_type: 'tool_executed',
        event_data: {
          tool_name: tool.name,
          parameters: tool.parameters,
          success: result.success,
          error: result.error,
        },
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    console.warn('[ToolExecutor] Failed to log tool execution:', error);
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create tool executor node with configuration
 */
export function createToolExecutorNode(config?: ToolExecutorConfig) {
  return (state: VoiceAgentState) => toolExecutorNode(state, config);
}

/**
 * Create custom tool registry
 */
export function createToolRegistry(
  tools: Record<string, ToolDefinition>
): ToolRegistry {
  return new DefaultToolRegistry(tools);
}

/**
 * Merge custom tools with defaults
 */
export function mergeTools(
  customTools: Record<string, ToolDefinition>
): Record<string, ToolDefinition> {
  return { ...defaultTools, ...customTools };
}

/**
 * Get list of available tools
 */
export function getAvailableTools(): string[] {
  return Object.keys(defaultTools);
}

/**
 * Check if a tool requires confirmation
 */
export function toolRequiresConfirmation(toolName: string): boolean {
  const tool = defaultTools[toolName];
  return tool?.requiresConfirmation ?? requiresConfirmation(toolName);
}
