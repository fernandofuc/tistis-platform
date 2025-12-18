// =====================================================
// TIS TIS PLATFORM - Channel Connections API
// CRUD operations for channel connections with multi-account support
// =====================================================

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

// Get user context
async function getUserContext(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  return { user, userRole };
}

// ======================
// GET - Retrieve all channel connections for tenant
// Supports query params: channel, account_number
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel');
    const accountNumber = searchParams.get('account_number');

    let query = supabase
      .from('channel_connections')
      .select(`
        *,
        branches (
          id,
          name,
          city,
          is_headquarters
        )
      `)
      .eq('tenant_id', context.userRole.tenant_id)
      .order('channel')
      .order('account_number');

    if (channel) {
      query = query.eq('channel', channel);
    }
    if (accountNumber) {
      query = query.eq('account_number', parseInt(accountNumber));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Channels API] GET error:', error);
      return NextResponse.json({ error: 'Error al obtener canales' }, { status: 500 });
    }

    // Get tenant slug for webhook URLs
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', context.userRole.tenant_id)
      .single();

    // Transform data with webhook URLs
    const connectionsWithUrls = data?.map(conn => ({
      ...conn,
      webhook_url: tenant
        ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhook/${conn.channel}/${tenant.slug}`
        : null,
    })) || [];

    return NextResponse.json({
      success: true,
      data: connectionsWithUrls,
    });
  } catch (error) {
    console.error('[Channels API] GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// POST - Create new channel connection
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Check permissions
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos para crear canales' }, { status: 403 });
    }

    const body = await request.json();
    const { channel, account_number = 1, account_name, ...connectionData } = body;

    // Validate channel
    if (!['whatsapp', 'instagram', 'facebook', 'tiktok'].includes(channel)) {
      return NextResponse.json({ error: 'Canal inválido' }, { status: 400 });
    }

    // Validate account_number (1 or 2)
    if (![1, 2].includes(account_number)) {
      return NextResponse.json({ error: 'Número de cuenta debe ser 1 o 2' }, { status: 400 });
    }

    // Check if connection already exists for this channel + account_number
    const { data: existing } = await supabase
      .from('channel_connections')
      .select('id')
      .eq('tenant_id', context.userRole.tenant_id)
      .eq('channel', channel)
      .eq('account_number', account_number)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: `Ya existe una conexión para ${channel} cuenta #${account_number}`
      }, { status: 400 });
    }

    // Generate verify token if not provided
    const verifyToken = connectionData[`${channel}_verify_token`] ||
      `tistis_${channel.substring(0, 2)}_${Math.random().toString(36).substring(7)}`;

    // Build connection data
    const newConnection = {
      tenant_id: context.userRole.tenant_id,
      channel,
      account_number,
      account_name: account_name || `${channel.charAt(0).toUpperCase() + channel.slice(1)} ${account_number === 1 ? 'Principal' : 'Secundario'}`,
      status: 'configuring',
      ai_enabled: true,
      ...connectionData,
      [`${channel}_verify_token`]: verifyToken,
    };

    const { data, error } = await supabase
      .from('channel_connections')
      .insert(newConnection)
      .select()
      .single();

    if (error) {
      console.error('[Channels API] POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Get tenant slug for webhook URL
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', context.userRole.tenant_id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        webhook_url: tenant
          ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhook/${channel}/${tenant.slug}`
          : null,
        verify_token: verifyToken,
      },
    });
  } catch (error) {
    console.error('[Channels API] POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// PUT - Update channel connection
// ======================
export async function PUT(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Check permissions
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json({ error: 'Sin permisos para actualizar canales' }, { status: 403 });
    }

    const body = await request.json();
    const { id, tenant_id: _, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('channel_connections')
      .select('id, tenant_id')
      .eq('id', id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('channel_connections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Channels API] PUT error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Channels API] PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// ======================
// DELETE - Remove channel connection
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Check permissions (only owner can delete)
    if (context.userRole.role !== 'owner') {
      return NextResponse.json({ error: 'Solo el propietario puede eliminar canales' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('channel_connections')
      .select('id, tenant_id')
      .eq('id', id)
      .eq('tenant_id', context.userRole.tenant_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    const { error } = await supabase
      .from('channel_connections')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Channels API] DELETE error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Channels API] DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
