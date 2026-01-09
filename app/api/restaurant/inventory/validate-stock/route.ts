// =====================================================
// TIS TIS PLATFORM - Validate Stock API
// Validates if there's sufficient stock for an order
// Used by AI agents and order management before confirming orders
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, isValidUUID } from '@/src/shared/lib';

// ======================
// HELPERS
// ======================

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function successResponse<T>(data: T) {
  return NextResponse.json({ success: true, data });
}

// ======================
// POST - Validate Stock for Order Items
// ======================

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const body = await request.json();
    const { branch_id, items } = body;

    // Validate required fields
    if (!branch_id) {
      return errorResponse('branch_id es requerido', 400);
    }

    if (!isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('items es requerido y debe ser un array con al menos un elemento', 400);
    }

    // Validate items structure
    for (const item of items) {
      if (!item.menu_item_id || !isValidUUID(item.menu_item_id)) {
        return errorResponse('Cada item debe tener un menu_item_id válido', 400);
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return errorResponse('Cada item debe tener una quantity positiva', 400);
      }
    }

    // Call the PostgreSQL function
    const { data, error } = await supabase.rpc('validate_order_stock', {
      p_branch_id: branch_id,
      p_items: items,
    });

    if (error) {
      console.error('[validate-stock] RPC error:', error);
      return errorResponse('Error al validar stock: ' + error.message, 500);
    }

    // The function returns a table, so data is an array with one row
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    return successResponse({
      valid: result?.valid ?? false,
      out_of_stock_items: result?.out_of_stock_items ?? [],
      low_stock_warnings: result?.low_stock_warnings ?? [],
      message: result?.valid
        ? 'Stock suficiente para todos los items'
        : 'Stock insuficiente para algunos items',
    });

  } catch (error) {
    console.error('[validate-stock] Unexpected error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Error interno del servidor',
      500
    );
  }
}

// ======================
// GET - Health check / Documentation
// ======================

export async function GET() {
  return NextResponse.json({
    success: true,
    endpoint: '/api/restaurant/inventory/validate-stock',
    method: 'POST',
    description: 'Validates if there is sufficient stock for order items',
    usage: {
      body: {
        branch_id: 'UUID - Branch to validate stock for',
        items: [
          {
            menu_item_id: 'UUID - Menu item ID',
            quantity: 'number - Quantity to order',
          },
        ],
      },
      response: {
        valid: 'boolean - True if all items have sufficient stock',
        out_of_stock_items: 'string[] - Items without sufficient stock',
        low_stock_warnings: 'string[] - Items that will be low after order',
        message: 'string - Human readable status',
      },
    },
    example: {
      request: {
        branch_id: '123e4567-e89b-12d3-a456-426614174000',
        items: [
          { menu_item_id: '123e4567-e89b-12d3-a456-426614174001', quantity: 3 },
          { menu_item_id: '123e4567-e89b-12d3-a456-426614174002', quantity: 2 },
        ],
      },
    },
  });
}
