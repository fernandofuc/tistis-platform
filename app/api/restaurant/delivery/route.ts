// =====================================================
// TIS TIS PLATFORM - Delivery API
// API endpoints for delivery operations
// =====================================================
//
// ENDPOINTS:
// GET  /api/restaurant/delivery - List delivery orders
// POST /api/restaurant/delivery/calculate - Calculate delivery details
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
// VALIDATION HELPERS
// ======================

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeText(text: string | null | undefined, maxLength: number = 500): string | null {
  if (!text) return null;
  // Strip HTML tags and limit length
  return text.replace(/<[^>]*>/g, '').slice(0, maxLength);
}

// ======================
// AUTH HELPER
// ======================

async function getUserAndTenant(request: NextRequest) {
  const supabase = createServerClient();

  // Get auth token from header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, tenant_id: null, error: 'Unauthorized' };
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, tenant_id: null, error: 'Invalid token' };
  }

  // Get tenant from user_roles
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
// GET - List Delivery Orders
// ======================

export async function GET(request: NextRequest) {
  try {
    const { user, tenant_id, error: authError } = await getUserAndTenant(request);
    if (authError || !tenant_id) {
      return NextResponse.json(
        { success: false, error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const branch_id = searchParams.get('branch_id');
    const status = searchParams.get('status'); // delivery_status
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query using the view
    let query = supabase
      .from('v_active_delivery_orders')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (branch_id && isValidUUID(branch_id)) {
      query = query.eq('branch_id', branch_id);
    }

    if (status) {
      query = query.eq('delivery_status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[Delivery API] Error fetching orders:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch delivery orders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[Delivery API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
