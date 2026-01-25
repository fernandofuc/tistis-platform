// =====================================================
// TIS TIS PLATFORM - Customer Penalties API
// GET: List penalties, POST: Record penalty via RPC
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

// Valid violation types
const VALID_VIOLATION_TYPES = [
  'no_show',
  'no_pickup',
  'late_cancellation',
  'no_confirmation',
  'abuse',
  'fraud',
  'other',
] as const;

// Valid reference types
const VALID_REFERENCE_TYPES = ['appointment', 'order', 'reservation'] as const;

const MAX_QUERY_LIMIT = 100;

function sanitizeText(text: unknown, maxLength = 255): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

function sanitizePhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[^\d+]/g, '').slice(0, 20);
  return cleaned.length >= 10 ? cleaned : null;
}

function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// ======================
// GET - List Penalties
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const leadId = searchParams.get('lead_id');
    const phoneNumber = searchParams.get('phone_number');
    const violationType = searchParams.get('violation_type');
    const includeResolved = searchParams.get('include_resolved') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    // Validate UUIDs if provided
    if (leadId && !isValidUUID(leadId)) {
      return errorResponse('lead_id invalido', 400);
    }

    let query = supabase
      .from('customer_penalties')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeResolved) {
      query = query.eq('is_resolved', false);
    }

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    if (phoneNumber) {
      // Sanitize phone number to prevent injection
      const sanitizedPhoneQuery = sanitizePhone(phoneNumber);
      if (!sanitizedPhoneQuery) {
        return errorResponse('phone_number invalido', 400);
      }
      query = query.eq('phone_number', sanitizedPhoneQuery);
    }

    if (violationType && VALID_VIOLATION_TYPES.includes(violationType as typeof VALID_VIOLATION_TYPES[number])) {
      query = query.eq('violation_type', violationType);
    }

    const { data: penalties, error } = await query;

    if (error) {
      console.error('[penalties] Error fetching:', error);
      return errorResponse('Error al obtener penalizaciones', 500);
    }

    return successResponse(penalties);

  } catch (error) {
    console.error('[penalties] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Record Penalty via RPC
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
      lead_id,
      phone_number,
      violation_type,
      reference_type,
      reference_id,
      severity,
      description,
    } = body;

    // Validate required fields
    const requiredError = validateRequired(body, ['phone_number', 'violation_type', 'reference_type', 'reference_id']);
    if (requiredError) {
      return errorResponse(requiredError, 400);
    }

    // Validate phone
    const sanitizedPhone = sanitizePhone(phone_number);
    if (!sanitizedPhone) {
      return errorResponse('phone_number invalido', 400);
    }

    // Validate violation_type
    if (!VALID_VIOLATION_TYPES.includes(violation_type as typeof VALID_VIOLATION_TYPES[number])) {
      return errorResponse('violation_type invalido', 400);
    }

    // Validate reference_type
    if (!VALID_REFERENCE_TYPES.includes(reference_type as typeof VALID_REFERENCE_TYPES[number])) {
      return errorResponse('reference_type invalido', 400);
    }

    // Validate UUIDs
    if (!isValidUUID(reference_id as string)) {
      return errorResponse('reference_id invalido', 400);
    }
    if (lead_id && !isValidUUID(lead_id as string)) {
      return errorResponse('lead_id invalido', 400);
    }

    // Sanitize severity (1-5)
    const sanitizedSeverity = sanitizeNumber(severity, 1, 5, 3);

    // Call RPC to record penalty (handles trust score update and auto-block)
    const { data: result, error: rpcError } = await supabase.rpc('record_customer_penalty', {
      p_tenant_id: userRole.tenant_id,
      p_lead_id: lead_id || null,
      p_phone_number: sanitizedPhone,
      p_violation_type: violation_type,
      p_reference_type: reference_type,
      p_reference_id: reference_id,
      p_severity: sanitizedSeverity,
      p_description: sanitizeText(description, 500),
    });

    if (rpcError) {
      console.error('[penalties] RPC error:', rpcError);
      return errorResponse('Error al registrar penalizacion', 500);
    }

    // Check for authorization error
    if (result?.error === 'unauthorized') {
      return errorResponse('No autorizado', 403);
    }

    if (!result.success) {
      return errorResponse(result.message || 'Error al registrar penalizacion', 400);
    }

    return successResponse(result, 201);

  } catch (error) {
    console.error('[penalties] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
