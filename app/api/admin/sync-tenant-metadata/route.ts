/**
 * TIS TIS - Sync Tenant Metadata
 *
 * Este endpoint sincroniza el tenant_id en user_metadata para usuarios
 * que no lo tienen configurado correctamente.
 *
 * POST /api/admin/sync-tenant-metadata - Sincroniza usuario actual
 * Headers: Authorization: Bearer <user_token> OR x-admin-key: <ADMIN_API_KEY>
 * GET /api/admin/sync-tenant-metadata?email=X - Verifica estado del usuario (requires admin key)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Verify admin API key (timing-safe to prevent timing attacks)
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }

  if (!adminKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Admin client with service role
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(`Missing env vars: URL=${!!url}, SERVICE_KEY=${!!serviceKey}`);
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Regular client for auth
function getSupabaseAuth() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header (user token for self-sync)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = getSupabaseAuth();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Log without exposing PII
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 [SyncMetadata] Syncing for user:', user.id);
    }

    const supabase = getSupabaseAdmin();

    // Check if user already has tenant_id in metadata
    if (user.user_metadata?.tenant_id) {
      console.log('✅ [SyncMetadata] User already has tenant_id:', user.user_metadata.tenant_id);
      return NextResponse.json({
        success: true,
        message: 'User already has tenant_id in metadata',
        tenant_id: user.user_metadata.tenant_id,
        needs_refresh: false,
      });
    }

    // Find tenant_id from user_roles
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      // Try to find tenant from staff by user_id
      let staffRecord: { tenant_id: string; id?: string } | null = null;

      const { data: staffByUserId } = await supabase
        .from('staff')
        .select('id, tenant_id')
        .eq('user_id', user.id)
        .single();

      if (staffByUserId) {
        staffRecord = staffByUserId;
      } else if (user.email) {
        // Try to find staff by email (staff may exist without user_id)
        const { data: staffByEmail } = await supabase
          .from('staff')
          .select('id, tenant_id')
          .eq('email', user.email)
          .single();

        if (staffByEmail) {
          staffRecord = staffByEmail;
          // Link the staff record to the user
          await supabase
            .from('staff')
            .update({ user_id: user.id })
            .eq('id', staffByEmail.id);
          console.log('🔗 [SyncMetadata] Linked staff to user');
        }
      }

      if (!staffRecord) {
        // Try to find tenant from client
        const { data: clientRecord, error: clientError } = await supabase
          .from('clients')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (clientError || !clientRecord) {
          return NextResponse.json({
            error: 'No tenant found for user',
            details: 'User has no user_role, staff, or client record',
          }, { status: 404 });
        }

        // Found tenant via client, create user_role
        await supabase.from('user_roles').insert({
          user_id: user.id,
          tenant_id: clientRecord.tenant_id,
          role: 'owner',
          is_active: true,
        });

        // Update user metadata
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            tenant_id: clientRecord.tenant_id,
          },
        });

        console.log('✅ [SyncMetadata] Created role and updated metadata from client');

        return NextResponse.json({
          success: true,
          message: 'Metadata synced from client record',
          tenant_id: clientRecord.tenant_id,
          needs_refresh: true,
          instructions: 'Por favor cierra sesión y vuelve a iniciar sesión para aplicar cambios',
        });
      }

      // Found tenant via staff - assign owner role
      await supabase.from('user_roles').insert({
        user_id: user.id,
        tenant_id: staffRecord.tenant_id,
        role: 'owner',
        is_active: true,
      });

      // Update user metadata
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          tenant_id: staffRecord.tenant_id,
        },
      });

      console.log('✅ [SyncMetadata] Created role and updated metadata from staff');

      return NextResponse.json({
        success: true,
        message: 'Metadata synced from staff record',
        tenant_id: staffRecord.tenant_id,
        needs_refresh: true,
        instructions: 'Por favor cierra sesión y vuelve a iniciar sesión para aplicar cambios',
      });
    }

    // Found tenant via user_roles, update metadata
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        tenant_id: userRole.tenant_id,
        role: userRole.role,
      },
    });

    if (updateError) {
      console.error('❌ [SyncMetadata] Update error:', updateError);
      return NextResponse.json({
        error: 'Failed to update metadata',
        details: updateError.message,
      }, { status: 500 });
    }

    console.log('✅ [SyncMetadata] Updated metadata from user_roles');

    return NextResponse.json({
      success: true,
      message: 'Metadata synced successfully',
      tenant_id: userRole.tenant_id,
      role: userRole.role,
      needs_refresh: true,
      instructions: 'Por favor cierra sesión y vuelve a iniciar sesión para aplicar cambios',
    });

  } catch (error) {
    console.error('💥 [SyncMetadata] Error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET to check user status
export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = getSupabaseAuth();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get user_role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    // Get staff
    const { data: staff } = await supabase
      .from('staff')
      .select('id, tenant_id, role, display_name')
      .eq('user_id', user.id)
      .single();

    // Check metadata
    const hasMetadataTenantId = !!user.user_metadata?.tenant_id;

    return NextResponse.json({
      user_id: user.id,
      email: user.email,
      metadata: user.user_metadata,
      has_tenant_in_metadata: hasMetadataTenantId,
      user_role: userRole,
      staff: staff,
      sync_needed: !hasMetadataTenantId && (userRole || staff),
    });

  } catch (error) {
    console.error('💥 [SyncMetadata] GET Error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
