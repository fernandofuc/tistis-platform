// =====================================================
// TIS TIS PLATFORM - Send Confirmation API
// POST: Send confirmation message via WhatsApp/SMS/Email
// =====================================================
//
// SINCRONIZADO CON:
// - Service: src/features/secure-booking/services/confirmation-sender.service.ts
// - Types: src/features/secure-booking/types/index.ts
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
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
import {
  confirmationSenderService,
  type SendConfirmationInput,
} from '@/src/features/secure-booking/services/confirmation-sender.service';
import type { ReferenceType, ConfirmationType, AutoActionOnExpire } from '@/src/features/secure-booking/types';

// ======================
// POST - Send Confirmation
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return errorResponse('ID invalido', 400);
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    // Get the confirmation with reference data
    const { data: confirmation, error: fetchError } = await supabase
      .from('booking_confirmations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (fetchError || !confirmation) {
      return errorResponse('Confirmacion no encontrada', 404);
    }

    // Check if already sent - allow pending and failed (for retries)
    if (!['pending', 'failed'].includes(confirmation.status)) {
      return errorResponse('La confirmacion ya fue enviada o procesada', 400);
    }

    // Get reference data based on type
    const referenceData = await getReferenceData(
      supabase,
      confirmation.reference_type as ReferenceType,
      confirmation.reference_id,
      userRole.tenant_id
    );

    if (!referenceData) {
      return errorResponse('No se encontraron datos de la reserva', 404);
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, phone')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    // Build input for sender service - pass existing ID to update instead of create
    const input: SendConfirmationInput = {
      existingConfirmationId: id,
      tenantId: userRole.tenant_id,
      referenceType: confirmation.reference_type as ReferenceType,
      referenceId: confirmation.reference_id,
      confirmationType: confirmation.confirmation_type as ConfirmationType,
      channel: confirmation.sent_via || 'whatsapp',
      recipientPhone: referenceData.phone,
      recipientName: referenceData.name,
      businessName: tenant?.name || 'Negocio',
      businessPhone: tenant?.phone,
      branchName: referenceData.branchName,
      branchAddress: referenceData.branchAddress,
      bookingDatetime: referenceData.datetime,
      serviceName: referenceData.serviceName,
      staffName: referenceData.staffName,
      partySize: referenceData.partySize,
      orderItems: referenceData.orderItems,
      totalAmount: referenceData.totalAmount,
      expiresAt: confirmation.expires_at,
      autoActionOnExpire: confirmation.auto_action_on_expire as AutoActionOnExpire,
    };

    // Send via the service (will update existing record, not create new)
    const result = await confirmationSenderService.sendConfirmation(input);

    if (!result.success) {
      console.error('[confirmations/:id/send] Send failed:', result.error);
      return errorResponse(result.error || 'Error al enviar confirmacion', 500);
    }

    // Get the new confirmation record
    const { data: sentConfirmation } = await supabase
      .from('booking_confirmations')
      .select('*')
      .eq('id', result.confirmationId)
      .single();

    return successResponse({
      ...sentConfirmation,
      whatsapp_message_id: result.messageId,
      retry_count: result.retryCount,
    });

  } catch (error) {
    console.error('[confirmations/:id/send] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// HELPER: Get Reference Data
// ======================
interface ReferenceData {
  phone: string;
  name: string;
  datetime: string;
  branchName?: string;
  branchAddress?: string;
  serviceName?: string;
  staffName?: string;
  partySize?: number;
  orderItems?: string[];
  totalAmount?: number;
}

async function getReferenceData(
  supabase: ReturnType<typeof import('@/src/lib/api/auth-helper').getUserAndTenant> extends Promise<infer T> ? T extends { supabase: infer S } ? S : never : never,
  referenceType: ReferenceType,
  referenceId: string,
  tenantId: string
): Promise<ReferenceData | null> {
  switch (referenceType) {
    case 'appointment':
    case 'reservation': {
      const { data } = await supabase
        .from('appointments')
        .select(`
          id,
          start_datetime,
          party_size,
          leads(name, phone),
          services(name),
          staff(first_name, last_name),
          branches(name, address)
        `)
        .eq('id', referenceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!data) return null;

      // Handle Supabase joined data - can be object or array depending on relationship
      const leads = extractFirstItem<{ name: string; phone: string }>(data.leads);
      const services = extractFirstItem<{ name: string }>(data.services);
      const staff = extractFirstItem<{ first_name: string; last_name: string }>(data.staff);
      const branches = extractFirstItem<{ name: string; address: string }>(data.branches);

      return {
        phone: leads?.phone || '',
        name: leads?.name || '',
        datetime: data.start_datetime,
        branchName: branches?.name,
        branchAddress: branches?.address,
        serviceName: services?.name,
        staffName: staff ? `${staff.first_name} ${staff.last_name}` : undefined,
        partySize: data.party_size,
      };
    }

    case 'order': {
      const { data } = await supabase
        .from('restaurant_orders')
        .select(`
          id,
          created_at,
          pickup_datetime,
          total_amount,
          leads(name, phone),
          branches(name, address),
          restaurant_order_items(
            quantity,
            menu_items(name)
          )
        `)
        .eq('id', referenceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!data) return null;

      // Handle Supabase joined data
      const leads = extractFirstItem<{ name: string; phone: string }>(data.leads);
      const branches = extractFirstItem<{ name: string; address: string }>(data.branches);
      const rawItems = data.restaurant_order_items as unknown;
      const items = Array.isArray(rawItems) ? rawItems as Array<{
        quantity: number;
        menu_items: unknown;
      }> : [];

      const orderItems = items.map((item) => {
        const menuItem = extractFirstItem<{ name: string }>(item.menu_items);
        const itemName = menuItem?.name || 'Item';
        return item.quantity > 1 ? `${item.quantity}x ${itemName}` : itemName;
      });

      return {
        phone: leads?.phone || '',
        name: leads?.name || '',
        datetime: data.pickup_datetime || data.created_at,
        branchName: branches?.name,
        branchAddress: branches?.address,
        orderItems,
        totalAmount: data.total_amount,
      };
    }

    default:
      return null;
  }
}

// Helper to safely extract first item from Supabase joined data (can be object, array, or null)
function extractFirstItem<T>(data: unknown): T | null {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.length > 0 ? (data[0] as T) : null;
  return data as T;
}
