/**
 * TIS TIS PLATFORM - Admin Channel Operation Handler
 *
 * Maneja operaciones del día a día (inventario, pedidos, escalaciones).
 * Proporciona información en tiempo real del negocio.
 *
 * @module admin-channel/graph/nodes/operation-handler
 */

import type { AdminChannelStateType } from '../state';
import type { AdminIntent, AdminChannelType, AdminExecutedAction } from '../../types';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Operation]';

// UUID validation regex for security
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Timeout for database operations (10 seconds)
const DB_TIMEOUT_MS = 10000;

// =====================================================
// VALIDATION HELPERS
// =====================================================

function validateUUID(value: string, fieldName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${fieldName} format: not a valid UUID`);
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

// =====================================================
// OPERATION HANDLER NODE
// =====================================================

export async function operationHandlerNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  try {
    const { context, detectedIntent } = state;

    // P0 Security: Validate tenantId before any operations
    validateUUID(context.tenantId, 'tenantId');

    let result: OperationResult;

    switch (detectedIntent) {
      case 'operation_inventory_check':
        result = await handleInventoryCheck(context.tenantId, context.channel);
        break;
      case 'operation_pending_orders':
        result = await handlePendingOrders(context.tenantId, context.channel, context.vertical);
        break;
      case 'operation_escalations':
        result = await handleEscalations(context.tenantId, context.channel);
        break;
      case 'operation_appointments_today':
        result = await handleAppointmentsToday(context.tenantId, context.channel, context.vertical);
        break;
      case 'operation_pending_leads':
        result = await handlePendingLeads(context.tenantId, context.channel);
        break;
      default:
        result = showOperationsMenu(context.channel);
    }

    const executedAction: AdminExecutedAction = {
      type: 'operation_query',
      entityType: detectedIntent,
      success: true,
      executedAt: new Date(),
    };

    console.log(`${LOG_PREFIX} Processed ${detectedIntent}`);

    return {
      response: result.response,
      keyboard: result.keyboard,
      executedActions: [executedAction],
      shouldEnd: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      response: '❌ Error obteniendo información operativa. Intenta de nuevo.',
      shouldEnd: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

// =====================================================
// TYPES
// =====================================================

interface OperationResult {
  response: string;
  keyboard?: Array<Array<{ text: string; callback_data: string }>> | null;
}

// =====================================================
// SUPABASE CLIENT
// =====================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// =====================================================
// HANDLER FUNCTIONS
// =====================================================

function showOperationsMenu(channel: AdminChannelType): OperationResult {
  const isTelegram = channel === 'telegram';

  const keyboard = isTelegram
    ? [
        [
          { text: '📦 Inventario bajo', callback_data: 'operation_inventory' },
          { text: '📋 Pedidos pendientes', callback_data: 'operation_orders' },
        ],
        [
          { text: '⚠️ Escalaciones', callback_data: 'operation_escalations' },
          { text: '📅 Citas de hoy', callback_data: 'operation_appointments' },
        ],
      ]
    : null;

  return {
    response:
      `📊 Operaciones del Día\n\n` +
      `¿Qué información necesitas?\n\n` +
      `• "inventario bajo"\n` +
      `• "pedidos pendientes"\n` +
      `• "escalaciones"\n` +
      `• "citas de hoy"\n` +
      `• "leads pendientes"`,
    keyboard,
  };
}

async function handleInventoryCheck(
  tenantId: string,
  channel: AdminChannelType
): Promise<OperationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    // Query productos con bajo stock
    const { data: lowStock, error } = await supabase
      .from('products')
      .select('name, stock_quantity, min_stock_alert')
      .eq('tenant_id', tenantId)
      .lt('stock_quantity', supabase.rpc('get_min_stock', { tenant: tenantId }))
      .order('stock_quantity', { ascending: true })
      .limit(10);

    if (error) {
      console.error(`${LOG_PREFIX} Inventory query error:`, error);
    }

    if (!lowStock || lowStock.length === 0) {
      return {
        response: `✅ ${isTelegram ? '<b>Inventario OK</b>' : 'Inventario OK'}\n\n` +
          `No hay productos con stock bajo en este momento.`,
      };
    }

    let response = `${isTelegram ? '<b>⚠️ Inventario Bajo</b>' : '⚠️ Inventario Bajo'}\n\n`;
    response += `${lowStock.length} productos necesitan reposición:\n\n`;

    lowStock.forEach((item, i) => {
      response += `${i + 1}. ${item.name}: ${item.stock_quantity} unidades\n`;
    });

    const keyboard = isTelegram
      ? [[{ text: '📦 Ver detalles en dashboard', callback_data: 'open_inventory' }]]
      : null;

    return { response, keyboard };
  } catch {
    return {
      response:
        `📦 Inventario\n\n` +
        `No se pudo obtener información de inventario.\n` +
        `Verifica en el dashboard web.`,
    };
  }
}

async function handlePendingOrders(
  tenantId: string,
  channel: AdminChannelType,
  vertical: string
): Promise<OperationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    // Query según vertical
    const tableName = vertical === 'restaurant' ? 'orders' : 'appointments';
    const { data: pending, error } = await supabase
      .from(tableName)
      .select('id, created_at, status')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error(`${LOG_PREFIX} Orders query error:`, error);
    }

    const itemName = vertical === 'restaurant' ? 'pedidos' : 'citas';

    if (!pending || pending.length === 0) {
      return {
        response: `✅ Sin ${itemName} pendientes\n\n` +
          `No hay ${itemName} que requieran atención.`,
      };
    }

    let response = `${isTelegram ? `<b>📋 ${pending.length} ${itemName} pendientes</b>` : `📋 ${pending.length} ${itemName} pendientes`}\n\n`;

    pending.slice(0, 5).forEach((item, i) => {
      const time = new Date(item.created_at).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      response += `${i + 1}. #${item.id.slice(0, 8)} - ${time} (${item.status})\n`;
    });

    if (pending.length > 5) {
      response += `\n... y ${pending.length - 5} más`;
    }

    return { response };
  } catch {
    return {
      response: `📋 Pedidos/Citas Pendientes\n\n` +
        `No se pudo obtener la información.\n` +
        `Verifica en el dashboard.`,
    };
  }
}

async function handleEscalations(
  tenantId: string,
  channel: AdminChannelType
): Promise<OperationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    // Query conversaciones escaladas
    const { data: escalations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        escalated_at,
        escalation_reason,
        leads (
          first_name,
          last_name,
          phone
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('is_escalated', true)
      .eq('is_resolved', false)
      .order('escalated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error(`${LOG_PREFIX} Escalations query error:`, error);
    }

    if (!escalations || escalations.length === 0) {
      return {
        response: `✅ Sin escalaciones pendientes\n\n` +
          `No hay conversaciones escaladas que requieran atención.`,
      };
    }

    let response = `${isTelegram ? `<b>⚠️ ${escalations.length} Escalaciones</b>` : `⚠️ ${escalations.length} Escalaciones`}\n\n`;

    escalations.forEach((esc, i) => {
      // leads can be an array from Supabase join or a single object
      const leadsData = esc.leads as unknown;
      const lead = Array.isArray(leadsData) ? leadsData[0] : leadsData;
      const typedLead = lead as { first_name: string; last_name: string; phone: string } | null | undefined;
      const name = typedLead ? `${typedLead.first_name} ${typedLead.last_name || ''}`.trim() : 'Cliente';
      response += `${i + 1}. ${name}\n   Razón: ${esc.escalation_reason || 'No especificada'}\n\n`;
    });

    const keyboard = isTelegram
      ? [[{ text: '💬 Ver en Inbox', callback_data: 'open_inbox_escalations' }]]
      : null;

    return { response, keyboard };
  } catch {
    return {
      response: `⚠️ Escalaciones\n\n` +
        `No se pudo obtener información.\n` +
        `Verifica en el Inbox del dashboard.`,
    };
  }
}

async function handleAppointmentsToday(
  tenantId: string,
  channel: AdminChannelType,
  vertical: string
): Promise<OperationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        status,
        services (name),
        leads (first_name, last_name)
      `)
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', startOfDay)
      .lte('scheduled_at', endOfDay)
      .order('scheduled_at', { ascending: true });

    if (error) {
      console.error(`${LOG_PREFIX} Appointments query error:`, error);
    }

    const appointmentLabel = vertical === 'restaurant' ? 'reservaciones' : 'citas';

    if (!appointments || appointments.length === 0) {
      return {
        response: `📅 ${appointmentLabel.charAt(0).toUpperCase() + appointmentLabel.slice(1)} de Hoy\n\n` +
          `No hay ${appointmentLabel} programadas para hoy.`,
      };
    }

    let response = `${isTelegram ? `<b>📅 ${appointments.length} ${appointmentLabel} hoy</b>` : `📅 ${appointments.length} ${appointmentLabel} hoy`}\n\n`;

    appointments.slice(0, 8).forEach((apt) => {
      const time = new Date(apt.scheduled_at).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      });
      // leads/services can be an array from Supabase join or a single object
      const leadsData = apt.leads as unknown;
      const lead = Array.isArray(leadsData) ? leadsData[0] : leadsData;
      const typedLead = lead as { first_name: string; last_name: string } | null | undefined;
      const name = typedLead ? `${typedLead.first_name} ${typedLead.last_name || ''}`.trim() : 'Cliente';

      const servicesData = apt.services as unknown;
      const service = Array.isArray(servicesData) ? servicesData[0] : servicesData;
      const typedService = service as { name: string } | null | undefined;
      const serviceName = typedService?.name || '';
      response += `• ${time} - ${name}${serviceName ? ` (${serviceName})` : ''}\n`;
    });

    if (appointments.length > 8) {
      response += `\n... y ${appointments.length - 8} más`;
    }

    return { response };
  } catch {
    return {
      response: `📅 Citas de Hoy\n\n` +
        `No se pudo obtener información.\n` +
        `Verifica en el calendario del dashboard.`,
    };
  }
}

async function handlePendingLeads(
  tenantId: string,
  channel: AdminChannelType
): Promise<OperationResult> {
  const isTelegram = channel === 'telegram';

  try {
    const supabase = getSupabaseClient();

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, first_name, last_name, score, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['new', 'contacted'])
      .order('score', { ascending: false })
      .limit(5);

    if (error) {
      console.error(`${LOG_PREFIX} Leads query error:`, error);
    }

    if (!leads || leads.length === 0) {
      return {
        response: `✅ Sin leads pendientes de seguimiento`,
      };
    }

    let response = `${isTelegram ? `<b>🎯 ${leads.length} Leads pendientes</b>` : `🎯 ${leads.length} Leads pendientes`}\n\n`;

    leads.forEach((lead, i) => {
      const scoreEmoji = lead.score >= 80 ? '🔥' : lead.score >= 50 ? '🌡️' : '❄️';
      response += `${i + 1}. ${scoreEmoji} ${lead.first_name} ${lead.last_name || ''} (${lead.score})\n`;
    });

    const keyboard = isTelegram
      ? [[{ text: '👥 Ver todos los leads', callback_data: 'open_leads' }]]
      : null;

    return { response, keyboard };
  } catch {
    return {
      response: `🎯 Leads Pendientes\n\n` +
        `No se pudo obtener información.\n` +
        `Verifica en el dashboard.`,
    };
  }
}

// operationHandlerNode is already exported inline
