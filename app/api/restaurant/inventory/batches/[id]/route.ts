// =====================================================
// TIS TIS PLATFORM - Inventory Batch Detail API
// GET: Get batch, PUT: Update batch status
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
import { sanitizeText, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid batch statuses
const VALID_BATCH_STATUSES = ['available', 'reserved', 'consumed', 'expired', 'damaged'];

// ======================
// GET - Get Batch
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de lote inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: batch, error } = await supabase
      .from('inventory_batches')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit, category_id),
        supplier:inventory_suppliers(id, name, contact_name, phone)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !batch) {
      return errorResponse('Lote no encontrado', 404);
    }

    // Get movements for this batch
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('batch_id', id)
      .order('performed_at', { ascending: false });

    return successResponse({ ...batch, movements: movements || [] });

  } catch (error) {
    console.error('Get batch error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Batch
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de lote inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para actualizar lotes', 403);
    }

    const body = await request.json();

    // Build sanitized update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and set status
    if (body.status !== undefined) {
      if (!VALID_BATCH_STATUSES.includes(body.status)) {
        return errorResponse(`Estado inválido. Permitidos: ${VALID_BATCH_STATUSES.join(', ')}`, 400);
      }
      updateData.status = body.status;
    }

    // Validate expiration_date
    if (body.expiration_date !== undefined) {
      if (body.expiration_date === null) {
        updateData.expiration_date = null;
      } else {
        const expDate = new Date(body.expiration_date);
        if (isNaN(expDate.getTime())) {
          return errorResponse('Fecha de expiración inválida', 400);
        }
        updateData.expiration_date = expDate.toISOString();
      }
    }

    // Sanitize text fields
    if (body.notes !== undefined) {
      updateData.notes = sanitizeText(body.notes, LIMITS.MAX_TEXT_LONG);
    }

    if (body.batch_number !== undefined) {
      updateData.batch_number = sanitizeText(body.batch_number, 50);
    }

    if (body.lot_number !== undefined) {
      updateData.lot_number = sanitizeText(body.lot_number, 50);
    }

    const { data: batch, error } = await supabase
      .from('inventory_batches')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (error || !batch) {
      console.error('Error updating batch:', error);
      return errorResponse('Error al actualizar lote', 500);
    }

    return successResponse(batch);

  } catch (error) {
    console.error('Update batch error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
