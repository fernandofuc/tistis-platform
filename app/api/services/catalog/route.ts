// =====================================================
// TIS TIS PLATFORM - Services Catalog API Route
// Update service prices, duration, and availability
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with user's access token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Extract Bearer token from Authorization header
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Allowed fields for update
const ALLOWED_FIELDS = ['price_min', 'price_max', 'duration_minutes', 'is_active'];

// ======================
// PUT - Bulk update service catalog (prices, duration, active status)
// ======================
export async function PUT(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado - Token inválido' },
        { status: 401 }
      );
    }

    // Get user's tenant and verify permissions
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions (only owner, admin can modify services)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar servicios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updates } = body; // Array of { id, price_min?, price_max?, duration_minutes?, is_active? }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Se requiere un array de updates' },
        { status: 400 }
      );
    }

    // Validate all updates
    for (const update of updates) {
      if (!update.id) {
        return NextResponse.json(
          { error: 'Cada update debe tener un id' },
          { status: 400 }
        );
      }

      // Check for unknown fields
      const fields = Object.keys(update).filter(k => k !== 'id');
      for (const field of fields) {
        if (!ALLOWED_FIELDS.includes(field)) {
          return NextResponse.json(
            { error: `Campo no permitido: ${field}` },
            { status: 400 }
          );
        }
      }

      // Validate numeric fields
      if (update.price_min !== undefined && update.price_min !== null) {
        if (typeof update.price_min !== 'number' || update.price_min < 0) {
          return NextResponse.json(
            { error: 'price_min debe ser un número >= 0' },
            { status: 400 }
          );
        }
      }

      if (update.price_max !== undefined && update.price_max !== null) {
        if (typeof update.price_max !== 'number' || update.price_max < 0) {
          return NextResponse.json(
            { error: 'price_max debe ser un número >= 0' },
            { status: 400 }
          );
        }
      }

      if (update.duration_minutes !== undefined && update.duration_minutes !== null) {
        if (typeof update.duration_minutes !== 'number' || update.duration_minutes < 0) {
          return NextResponse.json(
            { error: 'duration_minutes debe ser un número >= 0' },
            { status: 400 }
          );
        }
      }

      if (update.is_active !== undefined && typeof update.is_active !== 'boolean') {
        return NextResponse.json(
          { error: 'is_active debe ser un booleano' },
          { status: 400 }
        );
      }
    }

    // Update each service
    const results = [];
    for (const update of updates) {
      const { id, ...fields } = update;

      // Only update if there are fields to update
      if (Object.keys(fields).length === 0) {
        results.push({ id, success: true, message: 'Sin cambios' });
        continue;
      }

      const { error } = await supabase
        .from('services')
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', userRole.tenant_id);

      if (error) {
        console.error(`[Services Catalog API] Error updating ${id}:`, error);
        results.push({ id, success: false, error: error.message });
      } else {
        results.push({ id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      message: `${successCount}/${updates.length} servicios actualizados`,
      results,
    });
  } catch (error) {
    console.error('[Services Catalog API] PUT error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
