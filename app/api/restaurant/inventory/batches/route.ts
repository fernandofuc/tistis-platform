// =====================================================
// TIS TIS PLATFORM - Inventory Batches API
// GET: List batches, POST: Create batch (receive stock)
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
import { sanitizeText, sanitizePrice, sanitizeInteger, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid batch statuses
const VALID_BATCH_STATUSES = ['available', 'reserved', 'consumed', 'expired', 'damaged'];

// ======================
// GET - List Batches
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
    const itemId = searchParams.get('item_id');
    const status = searchParams.get('status');
    const expiringDays = searchParams.get('expiring_days');
    const limit = sanitizeInteger(searchParams.get('limit'), 1, LIMITS.MAX_QUERY_LIMIT, 100);

    // Validate required branch_id
    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id inválido o requerido', 400);
    }

    let query = supabase
      .from('inventory_batches')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .order('received_at', { ascending: false })
      .limit(limit);

    // Validate optional item_id
    if (itemId) {
      if (!isValidUUID(itemId)) {
        return errorResponse('item_id inválido', 400);
      }
      query = query.eq('item_id', itemId);
    }

    // Validate status
    if (status) {
      if (!VALID_BATCH_STATUSES.includes(status)) {
        return errorResponse(`Estado inválido. Permitidos: ${VALID_BATCH_STATUSES.join(', ')}`, 400);
      }
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['available', 'reserved']);
    }

    // Validate and process expiring_days
    if (expiringDays) {
      const days = sanitizeInteger(expiringDays, 1, 365, 7);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      query = query
        .not('expiration_date', 'is', null)
        .lte('expiration_date', futureDate.toISOString());
    }

    const { data: batches, error } = await query;

    if (error) {
      console.error('Error fetching batches:', error);
      return errorResponse('Error al obtener lotes', 500);
    }

    return successResponse(batches);

  } catch (error) {
    console.error('Get batches error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Batch (Receive Stock)
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para recibir stock', 403);
    }

    const body = await request.json();

    // Validate required UUIDs
    if (!body.branch_id || !isValidUUID(body.branch_id)) {
      return errorResponse('branch_id inválido o requerido', 400);
    }

    if (!body.item_id || !isValidUUID(body.item_id)) {
      return errorResponse('item_id inválido o requerido', 400);
    }

    // Validate and sanitize quantity (must be positive)
    const initialQuantity = sanitizeInteger(body.initial_quantity, 1, 999999, 0);
    if (initialQuantity <= 0) {
      return errorResponse('La cantidad inicial debe ser mayor a 0', 400);
    }

    // Validate and sanitize unit cost (must be non-negative)
    const unitCost = sanitizePrice(body.unit_cost);
    if (unitCost <= 0) {
      return errorResponse('El costo unitario debe ser mayor a 0', 400);
    }

    // Validate optional supplier_id
    if (body.supplier_id && !isValidUUID(body.supplier_id)) {
      return errorResponse('supplier_id inválido', 400);
    }

    // Validate expiration_date if provided (must be in the future)
    let expirationDate = null;
    if (body.expiration_date) {
      const expDate = new Date(body.expiration_date);
      if (isNaN(expDate.getTime())) {
        return errorResponse('Fecha de expiración inválida', 400);
      }
      // Allow dates from today onwards (not strict future)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expDate < today) {
        return errorResponse('La fecha de expiración debe ser futura', 400);
      }
      expirationDate = expDate.toISOString();
    }

    // Validate manufactured_date if provided (must be in the past)
    let manufacturedDate = null;
    if (body.manufactured_date) {
      const mfgDate = new Date(body.manufactured_date);
      if (isNaN(mfgDate.getTime())) {
        return errorResponse('Fecha de manufactura inválida', 400);
      }
      if (mfgDate > new Date()) {
        return errorResponse('La fecha de manufactura no puede ser futura', 400);
      }
      manufacturedDate = mfgDate.toISOString();
    }

    // Sanitize text fields
    const batchNumber = sanitizeText(body.batch_number, 50);
    const lotNumber = sanitizeText(body.lot_number, 50);
    const invoiceNumber = sanitizeText(body.invoice_number, 50);
    const notes = sanitizeText(body.notes, LIMITS.MAX_TEXT_LONG);

    // Get item info to create movement
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('current_stock, unit')
      .eq('id', body.item_id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (itemError || !item) {
      return errorResponse('Item no encontrado', 404);
    }

    const totalCost = Math.round(initialQuantity * unitCost * 100) / 100;
    const previousStock = item.current_stock || 0;

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from('inventory_batches')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id: body.branch_id,
        item_id: body.item_id,
        batch_number: batchNumber,
        lot_number: lotNumber,
        initial_quantity: initialQuantity,
        current_quantity: initialQuantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        expiration_date: expirationDate,
        manufactured_date: manufacturedDate,
        supplier_id: body.supplier_id || null,
        invoice_number: invoiceNumber,
        notes: notes,
        status: 'available',
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        supplier:inventory_suppliers(id, name)
      `)
      .single();

    if (batchError) {
      console.error('Error creating batch:', batchError);
      return errorResponse('Error al crear lote', 500);
    }

    // Create inventory movement (this triggers stock update)
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id: body.branch_id,
        item_id: body.item_id,
        batch_id: batch.id,
        movement_type: 'purchase',
        quantity: initialQuantity,
        previous_stock: previousStock,
        new_stock: previousStock + initialQuantity,
        unit_cost: unitCost,
        total_cost: totalCost,
        reference_type: 'batch',
        reference_id: batch.id,
        performed_by: user.id,
        reason: `Recepción de lote ${batchNumber || batch.id.slice(0, 8)}`,
      });

    if (movementError) {
      console.error('Error creating movement:', movementError);
      // Note: batch was created, movement failed - log but continue
    }

    return successResponse(batch, 201);

  } catch (error) {
    console.error('Create batch error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
