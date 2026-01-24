// =====================================================
// TIS TIS PLATFORM - Calculate Delivery Tool
// Voice Agent tool for calculating delivery details
// =====================================================
//
// CAPABILITIES: delivery
// ENABLED_FOR: rest_complete
// REQUIRES_CONFIRMATION: false
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - API: /api/restaurant/delivery/calculate
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type {
  DeliveryCalculationResult,
} from '@/src/shared/types/delivery-types';

// ======================
// TOOL DEFINITION
// ======================

export const calculateDeliveryToolDefinition = {
  name: 'calculate_delivery',
  description: `
    Calculate delivery details for a given address.
    Returns delivery fee, estimated time, and whether the address is within delivery zone.
    Use this tool when a customer wants to order for delivery.
    ALWAYS call this tool before creating a delivery order to verify the address is valid.
  `,
  parameters: z.object({
    street: z.string().describe('Street name'),
    exterior_number: z.string().describe('Exterior number (house/building number)'),
    interior_number: z.string().optional().describe('Interior number (apartment, unit)'),
    colony: z.string().describe('Colony/neighborhood name'),
    city: z.string().describe('City name'),
    postal_code: z.string().describe('Postal code (5 digits)'),
    reference: z.string().optional().describe('Reference to find the address'),
    contact_phone: z.string().describe('Phone number for delivery contact'),
    contact_name: z.string().describe('Name of person receiving the order'),
  }),
  requiredCapabilities: ['delivery'] as const,
  requiresConfirmation: false,
  enabledFor: ['rest_complete'] as const,
  timeout: 10000,
};

// ======================
// TOOL SCHEMA
// ======================

export const calculateDeliverySchema = calculateDeliveryToolDefinition.parameters;

export type CalculateDeliveryParams = z.infer<typeof calculateDeliverySchema>;

// ======================
// TOOL IMPLEMENTATION
// ======================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export interface CalculateDeliveryContext {
  tenantId: string;
  branchId: string;
  language?: 'es' | 'en';
}

export interface CalculateDeliveryResult {
  success: boolean;
  canDeliver: boolean;
  deliveryFee: number;
  estimatedMinutes: number;
  distanceKm: number;
  message: string;
  voiceMessage: string;
  minimumOrder?: number;
  freeDeliveryThreshold?: number;
}

export async function calculateDelivery(
  params: CalculateDeliveryParams,
  context: CalculateDeliveryContext
): Promise<CalculateDeliveryResult> {
  const { tenantId, branchId, language = 'es' } = context;

  try {
    const supabase = createServerClient();

    // Build delivery address object
    const deliveryAddress = {
      street: params.street,
      exterior_number: params.exterior_number,
      interior_number: params.interior_number || undefined,
      colony: params.colony,
      city: params.city,
      postal_code: params.postal_code,
      reference: params.reference || undefined,
      contact_phone: params.contact_phone,
      contact_name: params.contact_name,
      // Note: In production, you'd use a geocoding service to get coordinates
      coordinates: undefined,
    };

    // Call the calculate_delivery_details function
    const { data, error } = await supabase.rpc('calculate_delivery_details', {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_delivery_address: deliveryAddress,
    });

    if (error) {
      console.error('[Calculate Delivery] RPC error:', error);
      return {
        success: false,
        canDeliver: false,
        deliveryFee: 0,
        estimatedMinutes: 0,
        distanceKm: 0,
        message: 'Error al calcular el delivery',
        voiceMessage: language === 'es'
          ? 'Lo siento, hubo un error al verificar la dirección. ¿Podrías repetirla?'
          : 'Sorry, there was an error verifying the address. Could you repeat it?',
      };
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.is_within_zone) {
      const distanceKm = result?.distance_km || 0;
      return {
        success: true,
        canDeliver: false,
        deliveryFee: 0,
        estimatedMinutes: 0,
        distanceKm,
        message: result?.message || 'Dirección fuera de zona de cobertura',
        voiceMessage: language === 'es'
          ? `Lo siento, la dirección está a ${distanceKm.toFixed(1)} kilómetros y está fuera de nuestra zona de entrega. ¿Te gustaría hacer tu pedido para recoger en el restaurante?`
          : `Sorry, the address is ${distanceKm.toFixed(1)} kilometers away and is outside our delivery zone. Would you like to place your order for pickup instead?`,
      };
    }

    const deliveryFee = result.delivery_fee || 0;
    const estimatedMinutes = result.estimated_minutes || 30;
    const minimumOrder = result.minimum_order || 0;
    const freeDeliveryThreshold = result.free_delivery_threshold;

    // Build voice message
    let voiceMessage: string;
    if (language === 'es') {
      voiceMessage = `¡Perfecto! Sí hacemos entregas a tu zona. `;
      if (deliveryFee > 0) {
        voiceMessage += `El costo de envío es de ${deliveryFee} pesos. `;
      } else {
        voiceMessage += `El envío es gratis. `;
      }
      voiceMessage += `El tiempo estimado de entrega es de ${estimatedMinutes} minutos aproximadamente.`;
      if (minimumOrder > 0) {
        voiceMessage += ` El pedido mínimo es de ${minimumOrder} pesos.`;
      }
    } else {
      voiceMessage = `Great! Yes, we deliver to your area. `;
      if (deliveryFee > 0) {
        voiceMessage += `The delivery fee is ${deliveryFee} pesos. `;
      } else {
        voiceMessage += `Delivery is free. `;
      }
      voiceMessage += `Estimated delivery time is about ${estimatedMinutes} minutes.`;
      if (minimumOrder > 0) {
        voiceMessage += ` Minimum order is ${minimumOrder} pesos.`;
      }
    }

    return {
      success: true,
      canDeliver: true,
      deliveryFee,
      estimatedMinutes,
      distanceKm: result.distance_km || 0,
      message: 'Dirección válida para delivery',
      voiceMessage,
      minimumOrder: minimumOrder > 0 ? minimumOrder : undefined,
      freeDeliveryThreshold: freeDeliveryThreshold || undefined,
    };
  } catch (error) {
    console.error('[Calculate Delivery] Error:', error);
    return {
      success: false,
      canDeliver: false,
      deliveryFee: 0,
      estimatedMinutes: 0,
      distanceKm: 0,
      message: 'Error interno',
      voiceMessage: language === 'es'
        ? 'Lo siento, no pude verificar la dirección. ¿Podrías intentar de nuevo?'
        : 'Sorry, I could not verify the address. Could you try again?',
    };
  }
}

export default calculateDelivery;
