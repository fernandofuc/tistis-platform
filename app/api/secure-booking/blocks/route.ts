// =====================================================
// TIS TIS PLATFORM - Customer Blocks API
// GET: List blocks, POST: Create block
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';

// Valid block reasons
const VALID_BLOCK_REASONS = [
  'auto_no_shows',
  'auto_no_pickups',
  'auto_late_cancellations',
  'auto_low_trust',
  'manual_abuse',
  'manual_fraud',
  'manual_other',
] as const;

const MAX_QUERY_LIMIT = 100;

function sanitizeText(text: unknown, maxLength = 255): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').trim().slice(0, maxLength) || null;
}

function sanitizePhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  // Remove non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '').slice(0, 20);
  return cleaned.length >= 10 ? cleaned : null;
}

// ======================
// GET - List Blocks
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
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '50');
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    // Validate UUIDs if provided
    if (leadId && !isValidUUID(leadId)) {
      return errorResponse('lead_id invalido', 400);
    }

    let query = supabase
      .from('customer_blocks')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeInactive) {
      query = query.eq('is_active', true);
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

    const { data: blocks, error } = await query;

    if (error) {
      console.error('[blocks] Error fetching:', error);
      return errorResponse('Error al obtener bloqueos', 500);
    }

    return successResponse(blocks);

  } catch (error) {
    console.error('[blocks] GET error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Block
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, user, supabase } = auth;

    // Only manager+ can create blocks
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para bloquear clientes', 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse('JSON invalido en el cuerpo de la solicitud', 400);
    }

    const {
      lead_id,
      phone_number,
      block_reason,
      block_details,
      unblock_at,
    } = body;

    // Validate required fields
    const sanitizedPhone = sanitizePhone(phone_number);
    if (!sanitizedPhone) {
      return errorResponse('phone_number requerido y debe ser valido', 400);
    }

    if (!block_reason || !VALID_BLOCK_REASONS.includes(block_reason as typeof VALID_BLOCK_REASONS[number])) {
      return errorResponse('block_reason invalido', 400);
    }

    // Validate UUIDs if provided
    if (lead_id && !isValidUUID(lead_id as string)) {
      return errorResponse('lead_id invalido', 400);
    }

    // Validate unblock_at if provided
    let sanitizedUnblockAt: string | null = null;
    if (unblock_at) {
      const unblockDate = new Date(unblock_at as string);
      if (isNaN(unblockDate.getTime()) || unblockDate <= new Date()) {
        return errorResponse('unblock_at debe ser una fecha futura valida', 400);
      }
      sanitizedUnblockAt = unblockDate.toISOString();
    }

    // Determine if this is a manual block
    const isManualBlock = (block_reason as string).startsWith('manual_');

    // Create block
    const { data: block, error: insertError } = await supabase
      .from('customer_blocks')
      .insert({
        tenant_id: userRole.tenant_id,
        lead_id: lead_id || null,
        phone_number: sanitizedPhone,
        block_reason,
        block_details: sanitizeText(block_details, 500),
        blocked_by_type: isManualBlock ? 'staff' : 'system',
        blocked_by_user_id: isManualBlock ? user.id : null,
        unblock_at: sanitizedUnblockAt,
      })
      .select()
      .single();

    if (insertError) {
      // Check for unique constraint violation (already blocked)
      if (insertError.code === '23505') {
        return errorResponse('Este cliente ya esta bloqueado', 409);
      }
      console.error('[blocks] Insert error:', insertError);
      return errorResponse('Error al crear bloqueo', 500);
    }

    // Update trust score if lead_id provided
    if (lead_id) {
      await supabase
        .from('customer_trust_scores')
        .update({
          is_blocked: true,
          block_reason,
          blocked_at: new Date().toISOString(),
        })
        .eq('tenant_id', userRole.tenant_id)
        .eq('lead_id', lead_id);
    }

    return successResponse(block, 201);

  } catch (error) {
    console.error('[blocks] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
