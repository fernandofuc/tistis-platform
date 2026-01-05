// =====================================================
// TIS TIS PLATFORM - Low Stock Alert Detail API
// GET: Get alert, PUT: Update status, DELETE: Dismiss
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  successMessage,
  isValidUUID,
  canWrite,
} from '@/src/lib/api/auth-helper';

// ======================
// GET - Get Alert
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de alerta inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .select(`
        *,
        item:inventory_items(
          id,
          name,
          sku,
          unit,
          current_stock,
          minimum_stock,
          preferred_supplier_id,
          reorder_quantity,
          category:inventory_categories(id, name)
        ),
        suggested_supplier:inventory_suppliers(id, name, whatsapp, phone, email),
        associated_order:restock_orders(id, order_number, status, created_at),
        branch:branches(id, name)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !alert) {
      return errorResponse('Alerta no encontrada', 404);
    }

    return successResponse(alert);

  } catch (error) {
    console.error('Get alert error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// PUT - Update Alert (Acknowledge, Resolve, etc.)
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de alerta inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    const body = await request.json();
    const { action, associated_order_id, ...updateData } = body;

    // Validate associated_order_id if provided
    if (associated_order_id && !isValidUUID(associated_order_id)) {
      return errorResponse('ID de orden inválido', 400);
    }

    // Manejar acciones específicas
    if (action) {
      switch (action) {
        case 'acknowledge':
          updateData.status = 'acknowledged';
          updateData.acknowledged_by = user.id;
          updateData.acknowledged_at = new Date().toISOString();
          break;

        case 'mark_ordered':
          updateData.status = 'ordered';
          if (associated_order_id) {
            updateData.associated_order_id = associated_order_id;
          }
          break;

        case 'resolve':
          updateData.status = 'resolved';
          updateData.resolved_by = user.id;
          updateData.resolved_at = new Date().toISOString();
          break;

        case 'reopen':
          updateData.status = 'open';
          updateData.resolved_by = null;
          updateData.resolved_at = null;
          break;

        default:
          return errorResponse('Acción no válida', 400);
      }
    }

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select(`
        *,
        item:inventory_items(id, name, sku, unit, current_stock),
        suggested_supplier:inventory_suppliers(id, name, whatsapp)
      `)
      .single();

    if (error || !alert) {
      console.error('Error updating alert:', error);
      return errorResponse('Error al actualizar alerta', 500);
    }

    return successResponse(alert);

  } catch (error) {
    console.error('Update alert error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// DELETE - Dismiss/Delete Alert
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID de alerta inválido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para eliminar alertas', 403);
    }

    // Soft delete - marcar como resuelta y descartada
    const { error } = await supabase
      .from('low_stock_alerts')
      .update({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        metadata: { dismissed: true, dismissed_at: new Date().toISOString() },
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error dismissing alert:', error);
      return errorResponse('Error al descartar alerta', 500);
    }

    return successMessage('Alerta descartada');

  } catch (error) {
    console.error('Delete alert error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
