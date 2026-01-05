// =====================================================
// TIS TIS PLATFORM - Restock Notification Preferences API
// GET: Get preferences, POST/PUT: Upsert preferences
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUserAndTenant(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Token inválido', status: 401 };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!userRole) {
    return { error: 'Sin tenant asociado', status: 403 };
  }

  return { user, userRole, supabase };
}

// Configuración por defecto
const DEFAULT_PREFERENCES = {
  warning_threshold_percent: 50,
  critical_threshold_percent: 25,
  notify_via_app: true,
  notify_via_email: true,
  notify_via_whatsapp: false,
  manager_emails: [],
  auto_create_alerts: true,
  auto_create_orders: false,
  auto_send_to_supplier: false,
  check_frequency_hours: 4,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

// ======================
// GET - Get Preferences
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    // Buscar preferencias específicas de sucursal o a nivel tenant
    let query = supabase
      .from('restock_notification_preferences')
      .select('*')
      .eq('tenant_id', userRole.tenant_id);

    if (branchId) {
      // Buscar preferencias de sucursal específica
      query = query.eq('branch_id', branchId);
    } else {
      // Buscar preferencias a nivel tenant (branch_id is null)
      query = query.is('branch_id', null);
    }

    const { data: preferences, error } = await query.maybeSingle();

    if (error) {
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener preferencias' }, { status: 500 });
    }

    // Si no existen preferencias, devolver valores por defecto
    if (!preferences) {
      return NextResponse.json({
        success: true,
        data: {
          ...DEFAULT_PREFERENCES,
          tenant_id: userRole.tenant_id,
          branch_id: branchId || null,
          is_default: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: { ...preferences, is_default: false } });

  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create/Update Preferences (Upsert)
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para modificar preferencias' }, { status: 403 });
    }

    const body = await request.json();
    const {
      branch_id = null,
      warning_threshold_percent,
      critical_threshold_percent,
      notify_via_app,
      notify_via_email,
      notify_via_whatsapp,
      manager_emails,
      auto_create_alerts,
      auto_create_orders,
      auto_send_to_supplier,
      check_frequency_hours,
      quiet_hours_start,
      quiet_hours_end,
    } = body;

    // Verificar si ya existen preferencias
    let existingQuery = supabase
      .from('restock_notification_preferences')
      .select('id')
      .eq('tenant_id', userRole.tenant_id);

    // Para null branch_id, usar .is() en lugar de .eq()
    if (branch_id === null) {
      existingQuery = existingQuery.is('branch_id', null);
    } else {
      existingQuery = existingQuery.eq('branch_id', branch_id);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    const preferencesData = {
      tenant_id: userRole.tenant_id,
      branch_id,
      warning_threshold_percent: warning_threshold_percent ?? DEFAULT_PREFERENCES.warning_threshold_percent,
      critical_threshold_percent: critical_threshold_percent ?? DEFAULT_PREFERENCES.critical_threshold_percent,
      notify_via_app: notify_via_app ?? DEFAULT_PREFERENCES.notify_via_app,
      notify_via_email: notify_via_email ?? DEFAULT_PREFERENCES.notify_via_email,
      notify_via_whatsapp: notify_via_whatsapp ?? DEFAULT_PREFERENCES.notify_via_whatsapp,
      manager_emails: manager_emails ?? DEFAULT_PREFERENCES.manager_emails,
      auto_create_alerts: auto_create_alerts ?? DEFAULT_PREFERENCES.auto_create_alerts,
      auto_create_orders: auto_create_orders ?? DEFAULT_PREFERENCES.auto_create_orders,
      auto_send_to_supplier: auto_send_to_supplier ?? DEFAULT_PREFERENCES.auto_send_to_supplier,
      check_frequency_hours: check_frequency_hours ?? DEFAULT_PREFERENCES.check_frequency_hours,
      quiet_hours_start: quiet_hours_start ?? DEFAULT_PREFERENCES.quiet_hours_start,
      quiet_hours_end: quiet_hours_end ?? DEFAULT_PREFERENCES.quiet_hours_end,
      updated_at: new Date().toISOString(),
    };

    let preferences;
    let error;

    if (existing) {
      // Actualizar
      const result = await supabase
        .from('restock_notification_preferences')
        .update(preferencesData)
        .eq('id', existing.id)
        .select()
        .single();

      preferences = result.data;
      error = result.error;
    } else {
      // Crear
      const result = await supabase
        .from('restock_notification_preferences')
        .insert(preferencesData)
        .select()
        .single();

      preferences = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving preferences:', error);
      return NextResponse.json({ success: false, error: 'Error al guardar preferencias' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: preferences,
      message: existing ? 'Preferencias actualizadas' : 'Preferencias creadas',
    }, { status: existing ? 200 : 201 });

  } catch (error) {
    console.error('Save preferences error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Preferences (Alias for POST)
// ======================
export async function PUT(request: NextRequest) {
  return POST(request);
}
