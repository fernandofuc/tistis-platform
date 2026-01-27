/**
 * TIS TIS PLATFORM - Admin Channel Link API
 * Genera y verifica códigos de vinculación para WhatsApp/Telegram
 *
 * @endpoint POST /api/admin-channel/link - Genera código de vinculación
 * @endpoint GET /api/admin-channel/link - Obtiene usuarios vinculados
 * @endpoint DELETE /api/admin-channel/link - Desvincula un usuario
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { getAdminChannelService } from '@/src/features/admin-channel';

// =====================================================
// VALIDATION HELPERS
// =====================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

const LOG_PREFIX = '[AdminChannel/Link]';

// =====================================================
// POST - Generate Link Code
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Solo admins pueden generar códigos
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can generate link codes' },
        { status: 403 }
      );
    }

    let body: { staffId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { staffId } = body;

    // Validar staffId si se proporciona
    if (staffId && !isValidUUID(staffId)) {
      return NextResponse.json(
        { error: 'Invalid staffId format' },
        { status: 400 }
      );
    }

    const service = getAdminChannelService();
    const result = await service.generateLinkCode(tenantId, staffId);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate link code' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        code: result.linkCode,
        expiresAt: result.expiresAt,
        userId: result.userId,
        instructions: {
          whatsapp: `Envía el código ${result.linkCode} al número de TIS TIS`,
          telegram: `Envía el código ${result.linkCode} a @TISTISBot en Telegram`,
        },
      },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Generate code error:`, error);
    return NextResponse.json(
      { error: 'Error generating link code' },
      { status: 500 }
    );
  }
}

// =====================================================
// GET - Get Linked Users
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can view linked users' },
        { status: 403 }
      );
    }

    // First, check if the table exists by doing a simple count
    const { error: tableCheckError } = await supabase
      .from('admin_channel_users')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (tableCheckError) {
      console.error(`${LOG_PREFIX} Table check error:`, tableCheckError);
      // If table doesn't exist, return empty array (graceful degradation)
      // Supabase returns different error messages depending on the client
      const isTableMissing =
        tableCheckError.code === '42P01' ||
        tableCheckError.message?.includes('does not exist') ||
        tableCheckError.message?.includes('Could not find the table') ||
        tableCheckError.message?.includes('schema cache');

      if (isTableMissing) {
        console.warn(`${LOG_PREFIX} Table admin_channel_users does not exist. Migration 177 may not be applied.`);
        return NextResponse.json({
          data: [],
          _warning: 'Admin Channel not configured. Run migration 177 to enable this feature.'
        });
      }
      return NextResponse.json(
        { error: `Database error: ${tableCheckError.message}` },
        { status: 500 }
      );
    }

    // Query users - fetch without JOIN first for robustness
    const { data: users, error: usersError } = await supabase
      .from('admin_channel_users')
      .select(`
        id,
        staff_id,
        phone_normalized,
        telegram_user_id,
        telegram_username,
        status,
        linked_at,
        can_view_analytics,
        can_configure,
        can_receive_notifications,
        messages_today,
        last_message_at,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error(`${LOG_PREFIX} Users query error:`, usersError);
      // Check if this is a "table not found" error
      const isTableMissing =
        usersError.code === '42P01' ||
        usersError.message?.includes('does not exist') ||
        usersError.message?.includes('Could not find the table') ||
        usersError.message?.includes('schema cache');

      if (isTableMissing) {
        console.warn(`${LOG_PREFIX} Table admin_channel_users does not exist. Migration 177 may not be applied.`);
        return NextResponse.json({
          data: [],
          _warning: 'Admin Channel not configured. Run migration 177 to enable this feature.'
        });
      }
      return NextResponse.json(
        { error: `Query error: ${usersError.message}` },
        { status: 500 }
      );
    }

    // If there are users with staff_id, fetch staff info separately
    const usersWithStaffIds = (users || []).filter(u => u.staff_id);
    let staffMap: Record<string, { id: string; first_name: string; last_name: string; email: string }> = {};

    if (usersWithStaffIds.length > 0) {
      const staffIds = usersWithStaffIds.map(u => u.staff_id);
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email')
        .in('id', staffIds);

      if (staffError) {
        console.warn(`${LOG_PREFIX} Staff query warning (non-critical):`, staffError.message);
        // Continue without staff data - it's not critical
      } else if (staffData) {
        staffMap = staffData.reduce((acc, s) => {
          acc[s.id] = s;
          return acc;
        }, {} as typeof staffMap);
      }
    }

    // Combine users with staff data
    const data = (users || []).map(user => ({
      ...user,
      staff: user.staff_id ? staffMap[user.staff_id] || null : null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error(`${LOG_PREFIX} List users error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - Unlink User
// =====================================================

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can unlink users' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Validar formato UUID
    if (!isValidUUID(userId)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      );
    }

    // Verificar que el usuario pertenece al tenant
    const { data: user, error: fetchError } = await supabase
      .from('admin_channel_users')
      .select('id, staff_id')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found or access denied' },
        { status: 404 }
      );
    }

    // Desvincular (soft delete - cambiar status)
    const { error: updateError } = await supabase
      .from('admin_channel_users')
      .update({
        status: 'unlinked',
        phone_normalized: null,
        telegram_user_id: null,
        telegram_username: null,
      })
      .eq('id', userId);

    if (updateError) {
      console.error(`${LOG_PREFIX} Unlink error:`, updateError);
      return NextResponse.json(
        { error: 'Error unlinking user' },
        { status: 500 }
      );
    }

    // Registrar en audit log
    const service = getAdminChannelService();
    await service.logAuditAction({
      tenantId,
      userId,
      action: 'user_unlinked',
      actionCategory: 'auth',
      description: 'Usuario desvinculado del Admin Channel',
      channel: 'api',
    });

    console.log(`${LOG_PREFIX} User ${userId} unlinked from tenant ${tenantId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`${LOG_PREFIX} Unlink error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
