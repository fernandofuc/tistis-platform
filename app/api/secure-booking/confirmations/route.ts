// =====================================================
// TIS TIS PLATFORM - Booking Confirmations API
// GET: List confirmations, POST: Create confirmation
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

const MAX_QUERY_LIMIT = 100;

// Valid confirmation types
const VALID_CONFIRMATION_TYPES = ['voice_to_message', 'reminder_24h', 'reminder_2h', 'deposit_required', 'custom'] as const;
const VALID_CHANNELS = ['whatsapp', 'sms', 'email'] as const;
const VALID_STATUSES = ['pending', 'sent', 'delivered', 'read', 'responded', 'expired', 'failed'] as const;
const VALID_REFERENCE_TYPES = ['appointment', 'order', 'reservation'] as const;
const VALID_AUTO_ACTIONS = ['cancel', 'keep', 'notify_staff'] as const;

// ======================
// SECURITY HELPERS
// ======================

function isValidISODate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  return year >= 1970 && year <= 2100;
}

function isFutureDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date > new Date();
}

// ======================
// GET - List Confirmations
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const referenceType = searchParams.get('reference_type');
    const referenceId = searchParams.get('reference_id');
    const statusParam = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const whatsappMessageId = searchParams.get('whatsapp_message_id');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    // Validate UUIDs
    if (referenceId && !isValidUUID(referenceId)) {
      return errorResponse('reference_id invalido', 400);
    }

    let query = supabase
      .from('booking_confirmations')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (referenceType) {
      query = query.eq('reference_type', referenceType);
    }

    if (referenceId) {
      query = query.eq('reference_id', referenceId);
    }

    if (statusParam) {
      const statuses = statusParam.split(',').filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]));
      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }
    }

    if (dateFrom) {
      if (!isValidISODate(dateFrom)) {
        return errorResponse('date_from invalido', 400);
      }
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      if (!isValidISODate(dateTo)) {
        return errorResponse('date_to invalido', 400);
      }
      query = query.lte('created_at', dateTo);
    }

    if (whatsappMessageId) {
      query = query.eq('whatsapp_message_id', whatsappMessageId);
    }

    const { data: confirmations, error } = await query;

    if (error) {
      console.error('[confirmations] Error fetching:', error);
      return errorResponse('Error al obtener confirmaciones', 500);
    }

    return successResponse(confirmations);

  } catch (error) {
    console.error('[confirmations] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Confirmation
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const {
      reference_type,
      reference_id,
      confirmation_type,
      sent_via,
      expires_at,
      auto_action_on_expire,
      whatsapp_template_name,
      conversation_id,
    } = body;

    // Validate required fields
    if (!reference_type || !VALID_REFERENCE_TYPES.includes(reference_type as typeof VALID_REFERENCE_TYPES[number])) {
      return errorResponse('reference_type requerido y valido', 400);
    }

    if (!reference_id || !isValidUUID(reference_id as string)) {
      return errorResponse('reference_id requerido y valido', 400);
    }

    if (!confirmation_type || !VALID_CONFIRMATION_TYPES.includes(confirmation_type as typeof VALID_CONFIRMATION_TYPES[number])) {
      return errorResponse('confirmation_type requerido y valido', 400);
    }

    if (!sent_via || !VALID_CHANNELS.includes(sent_via as typeof VALID_CHANNELS[number])) {
      return errorResponse('sent_via requerido y valido (whatsapp, sms, email)', 400);
    }

    if (!expires_at) {
      return errorResponse('expires_at requerido', 400);
    }

    if (!isValidISODate(expires_at)) {
      return errorResponse('expires_at debe ser una fecha valida en formato ISO', 400);
    }

    if (!isFutureDate(expires_at as string)) {
      return errorResponse('expires_at debe ser una fecha futura', 400);
    }

    // Validate auto_action if provided
    if (auto_action_on_expire && !VALID_AUTO_ACTIONS.includes(auto_action_on_expire as typeof VALID_AUTO_ACTIONS[number])) {
      return errorResponse('auto_action_on_expire invalido', 400);
    }

    // Validate conversation_id if provided
    if (conversation_id && !isValidUUID(conversation_id as string)) {
      return errorResponse('conversation_id invalido', 400);
    }

    const confirmationData = {
      tenant_id: userRole.tenant_id,
      reference_type,
      reference_id,
      confirmation_type,
      sent_via,
      expires_at,
      auto_action_on_expire: auto_action_on_expire || 'notify_staff',
      whatsapp_template_name: whatsapp_template_name || null,
      conversation_id: conversation_id || null,
      status: 'pending',
    };

    const { data: confirmation, error } = await supabase
      .from('booking_confirmations')
      .insert(confirmationData)
      .select()
      .single();

    if (error) {
      console.error('[confirmations] Insert error:', error);
      return errorResponse('Error al crear confirmacion', 500);
    }

    return successResponse(confirmation, 201);

  } catch (error) {
    console.error('[confirmations] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
