// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Process API
// Manually trigger processing of pending SR sales
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { SoftRestaurantProcessor } from '@/src/features/integrations/services/soft-restaurant-processor';

// ========================================
// POST - Process specific sale by ID
// ========================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions - only admin/owner can process sales
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can process SR sales' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { sale_id } = body;

    if (!sale_id) {
      return NextResponse.json(
        { error: 'sale_id is required' },
        { status: 400 }
      );
    }

    // Verify sale belongs to tenant
    const { data: sale, error: saleError } = await supabase
      .from('sr_sales')
      .select('id, tenant_id, status')
      .eq('id', sale_id)
      .eq('tenant_id', tenantId)
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Sale not found or does not belong to this tenant' },
        { status: 404 }
      );
    }

    if (sale.status === 'processed') {
      return NextResponse.json(
        { error: 'Sale has already been processed' },
        { status: 400 }
      );
    }

    // Process the sale
    const processor = new SoftRestaurantProcessor();
    const result = await processor.processSale(sale_id);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Processing failed',
          message: result.error,
          details: result.details,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      saleId: result.saleId,
      restaurantOrderId: result.restaurantOrderId,
      inventoryDeducted: result.inventoryDeducted,
      details: result.details,
    });
  } catch (error) {
    console.error('[SR Process API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ========================================
// GET - Process all pending sales for tenant
// ========================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can process SR sales' },
        { status: 403 }
      );
    }

    // Get optional branch_id filter
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Build query
    let query = supabase
      .from('sr_sales')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(Math.min(limit, 50)); // Max 50 at once

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: pendingSales, error } = await query;

    if (error) {
      console.error('[SR Process API] Error fetching pending sales:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending sales' },
        { status: 500 }
      );
    }

    if (!pendingSales || pendingSales.length === 0) {
      return NextResponse.json({
        message: 'No pending sales to process',
        processed: 0,
        successful: 0,
        failed: 0,
        results: [],
      });
    }

    // Process each sale
    const processor = new SoftRestaurantProcessor();
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const sale of pendingSales) {
      const result = await processor.processSale(sale.id);
      results.push({
        saleId: sale.id,
        success: result.success,
        restaurantOrderId: result.restaurantOrderId,
        error: result.error,
      });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({
      message: `Processed ${pendingSales.length} sales`,
      processed: pendingSales.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('[SR Process API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
