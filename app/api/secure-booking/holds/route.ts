// =====================================================
// TIS TIS PLATFORM - Secure Booking Holds API
// GET: List holds, POST: Create hold via RPC
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  validateRequired,
} from '@/src/lib/api/auth-helper';

// Valid hold types
const VALID_HOLD_TYPES = ['voice_call', 'chat_session', 'manual'] as const;

// Valid statuses
const VALID_STATUSES = ['active', 'converted', 'expired', 'released'] as const;

// Limits
const MAX_QUERY_LIMIT = 100;

// ======================
// SECURITY HELPERS
// ======================

function sanitizeText(text: unknown, maxLength = 255): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

function isValidISODate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  // Validate ISO 8601 format and valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  // Ensure reasonable date range (1970-2100)
  const year = date.getFullYear();
  return year >= 1970 && year <= 2100;
}

// ======================
// GET - List Holds
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status')?.split(',').filter(s =>
      VALID_STATUSES.includes(s as typeof VALID_STATUSES[number])
    );
    const sessionId = searchParams.get('session_id');
    const leadId = searchParams.get('lead_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    // Validate UUIDs if provided
    if (branchId && !isValidUUID(branchId)) {
      return errorResponse('branch_id invalido', 400);
    }
    if (leadId && !isValidUUID(leadId)) {
      return errorResponse('lead_id invalido', 400);
    }

    let query = supabase
      .from('booking_holds')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status?.length) {
      query = query.in('status', status);
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    if (dateFrom) {
      if (!isValidISODate(dateFrom)) {
        return errorResponse('date_from invalido', 400);
      }
      query = query.gte('slot_datetime', dateFrom);
    }

    if (dateTo) {
      if (!isValidISODate(dateTo)) {
        return errorResponse('date_to invalido', 400);
      }
      query = query.lte('slot_datetime', dateTo);
    }

    const { data: holds, error } = await query;

    if (error) {
      console.error('[holds] Error fetching:', error);
      return errorResponse('Error al obtener holds', 500);
    }

    return successResponse(holds);

  } catch (error) {
    console.error('[holds] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Hold via RPC
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
      branch_id,
      slot_datetime,
      duration_minutes,
      hold_type,
      session_id,
      customer_phone,
      customer_name,
      lead_id,
      service_id,
      staff_id,
      hold_minutes,
    } = body;

    // Validate required fields
    const requiredError = validateRequired(body, ['slot_datetime', 'hold_type', 'session_id']);
    if (requiredError) {
      return errorResponse(requiredError, 400);
    }

    // Validate hold_type
    if (!VALID_HOLD_TYPES.includes(hold_type as typeof VALID_HOLD_TYPES[number])) {
      return errorResponse('hold_type invalido', 400);
    }

    // Validate UUIDs if provided
    if (branch_id && !isValidUUID(branch_id as string)) {
      return errorResponse('branch_id invalido', 400);
    }
    if (lead_id && !isValidUUID(lead_id as string)) {
      return errorResponse('lead_id invalido', 400);
    }
    if (service_id && !isValidUUID(service_id as string)) {
      return errorResponse('service_id invalido', 400);
    }
    if (staff_id && !isValidUUID(staff_id as string)) {
      return errorResponse('staff_id invalido', 400);
    }

    // Validate slot_datetime is a valid date
    const slotDate = new Date(slot_datetime as string);
    if (isNaN(slotDate.getTime())) {
      return errorResponse('slot_datetime invalido', 400);
    }

    // Sanitize values
    const sanitizedDuration = sanitizeNumber(duration_minutes, 5, 480, 30);
    const sanitizedHoldMinutes = sanitizeNumber(hold_minutes, 1, 60, 15);

    // Call RPC function (with advisory locks)
    const { data: result, error: rpcError } = await supabase.rpc('create_booking_hold', {
      p_tenant_id: userRole.tenant_id,
      p_branch_id: branch_id || null,
      p_slot_datetime: slot_datetime,
      p_duration_minutes: sanitizedDuration,
      p_hold_type: hold_type,
      p_session_id: sanitizeText(session_id, 255) || '',
      p_customer_phone: sanitizeText(customer_phone, 20),
      p_customer_name: sanitizeText(customer_name, 255),
      p_lead_id: lead_id || null,
      p_service_id: service_id || null,
      p_staff_id: staff_id || null,
      p_hold_minutes: sanitizedHoldMinutes,
    });

    if (rpcError) {
      console.error('[holds] RPC error:', rpcError);
      return errorResponse('Error al crear hold', 500);
    }

    // RPC returns jsonb with success, hold_id, etc.
    if (!result.success) {
      return errorResponse(result.message || result.error || 'Error al crear hold', 400);
    }

    return successResponse(result, 201);

  } catch (error) {
    console.error('[holds] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
