// =====================================================
// TIS TIS PLATFORM - Delivery Calculate API
// Calculate delivery details (fee, time, zone)
// =====================================================
//
// POST /api/restaurant/delivery/calculate
// Body: { branch_id, delivery_address }
// Returns: DeliveryCalculationResult
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Function: calculate_delivery_details()
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  DeliveryAddress,
  DeliveryCalculationResult,
} from '@/src/shared/types/delivery-types';

// ======================
// SUPABASE CLIENT
// ======================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ======================
// VALIDATION
// ======================

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeText(text: string | null | undefined, maxLength: number = 500): string | null {
  if (!text) return null;
  return text.replace(/<[^>]*>/g, '').slice(0, maxLength);
}

function validateDeliveryAddress(address: unknown): address is DeliveryAddress {
  if (!address || typeof address !== 'object') return false;
  const addr = address as Record<string, unknown>;
  return !!(
    addr.street &&
    typeof addr.street === 'string' &&
    addr.exterior_number &&
    typeof addr.exterior_number === 'string' &&
    addr.colony &&
    typeof addr.colony === 'string' &&
    addr.city &&
    typeof addr.city === 'string' &&
    addr.postal_code &&
    typeof addr.postal_code === 'string' &&
    addr.contact_phone &&
    typeof addr.contact_phone === 'string' &&
    addr.contact_name &&
    typeof addr.contact_name === 'string'
  );
}

// ======================
// AUTH HELPER
// ======================

async function getUserAndTenant(request: NextRequest) {
  const supabase = createServerClient();

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, tenant_id: null, error: 'Unauthorized' };
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, tenant_id: null, error: 'Invalid token' };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!userRole?.tenant_id) {
    return { user, tenant_id: null, error: 'No tenant assigned' };
  }

  return { user, tenant_id: userRole.tenant_id, error: null };
}

// ======================
// POST - Calculate Delivery
// ======================

export async function POST(request: NextRequest) {
  try {
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { branch_id, delivery_address } = body;

    if (!branch_id || !isValidUUID(branch_id)) {
      return NextResponse.json(
        { success: false, error: 'branch_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }

    if (!validateDeliveryAddress(delivery_address)) {
      return NextResponse.json(
        { success: false, error: 'delivery_address is required with street, exterior_number, colony, city, postal_code, contact_phone, contact_name' },
        { status: 400 }
      );
    }

    // Sanitize address fields
    const sanitizedAddress: DeliveryAddress = {
      street: sanitizeText(delivery_address.street, 200) || '',
      exterior_number: sanitizeText(delivery_address.exterior_number, 20) || '',
      interior_number: sanitizeText(delivery_address.interior_number, 20) || undefined,
      colony: sanitizeText(delivery_address.colony, 100) || '',
      city: sanitizeText(delivery_address.city, 100) || '',
      postal_code: sanitizeText(delivery_address.postal_code, 10) || '',
      state: sanitizeText(delivery_address.state, 100) || undefined,
      reference: sanitizeText(delivery_address.reference, 300) || undefined,
      contact_phone: sanitizeText(delivery_address.contact_phone, 20) || '',
      contact_name: sanitizeText(delivery_address.contact_name, 100) || '',
      coordinates: delivery_address.coordinates || undefined,
    };

    const supabase = createServerClient();

    // Verify branch belongs to tenant
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id, tenant_id')
      .eq('id', branch_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (branchError || !branch) {
      return NextResponse.json(
        { success: false, error: 'Branch not found or access denied' },
        { status: 404 }
      );
    }

    // Call the calculate_delivery_details function
    const { data, error } = await supabase.rpc('calculate_delivery_details', {
      p_tenant_id: tenant_id,
      p_branch_id: branch_id,
      p_delivery_address: sanitizedAddress,
    });

    if (error) {
      console.error('[Delivery Calculate] RPC error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to calculate delivery details' },
        { status: 500 }
      );
    }

    // The function returns a single row
    const result = Array.isArray(data) ? data[0] : data;

    const calculationResult: DeliveryCalculationResult = {
      is_within_zone: result?.is_within_zone ?? false,
      zone_id: result?.zone_id || undefined,
      zone_name: result?.zone_name || undefined,
      distance_km: result?.distance_km || undefined,
      estimated_minutes: result?.estimated_minutes || undefined,
      delivery_fee: result?.delivery_fee || undefined,
      minimum_order: result?.minimum_order || undefined,
      free_delivery_threshold: result?.free_delivery_threshold || undefined,
      message: result?.message || undefined,
    };

    return NextResponse.json({
      success: true,
      data: calculationResult,
    });
  } catch (error) {
    console.error('[Delivery Calculate] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
