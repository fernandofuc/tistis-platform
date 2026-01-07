// =====================================================
// TIS TIS PLATFORM - Invoice Config API Route
// Get and update invoice configuration
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getInvoiceService } from '@/src/features/invoicing';

// ======================
// TYPES
// ======================

interface UserRole {
  tenant_id: string;
  role: string;
}

// ======================
// HELPERS
// ======================

async function getTenantFromUser(supabase: SupabaseClient<any>, userId: string): Promise<UserRole | null> {
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    return null;
  }

  return userRole as UserRole;
}

// ======================
// GET - Get invoice configuration
// ======================

export async function GET(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const userRole = await getTenantFromUser(supabase, user.id);
    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found for user' }, { status: 403 });
    }

    // Get branch_id from query params
    const branchId = request.nextUrl.searchParams.get('branch_id') || undefined;

    // Get config
    const invoiceService = getInvoiceService();
    const config = await invoiceService.getConfig(userRole.tenant_id, branchId);

    // Return empty config structure if none exists (UI will show empty form)
    if (!config) {
      return NextResponse.json({
        tenant_id: userRole.tenant_id,
        rfc: '',
        razon_social: '',
        regimen_fiscal: '601',
        codigo_postal: '',
        domicilio_fiscal: '',
        serie: 'FAC',
        folio_actual: 0,
        tasa_iva: 0.16,
        auto_send_email: true,
        is_active: true,
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ======================
// POST - Create or update configuration
// ======================

export async function POST(request: NextRequest) {
  try {
    // Get authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenant
    const userRole = await getTenantFromUser(supabase, user.id);
    if (!userRole) {
      return NextResponse.json({ error: 'No tenant found for user' }, { status: 403 });
    }

    // Only owner/admin can configure invoicing
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can configure invoicing' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields for new config
    if (!body.rfc) {
      return NextResponse.json({ error: 'rfc is required' }, { status: 400 });
    }
    if (!body.razon_social) {
      return NextResponse.json({ error: 'razon_social is required' }, { status: 400 });
    }
    if (!body.regimen_fiscal) {
      return NextResponse.json({ error: 'regimen_fiscal is required' }, { status: 400 });
    }
    if (!body.codigo_postal) {
      return NextResponse.json({ error: 'codigo_postal is required' }, { status: 400 });
    }

    // Save config
    const invoiceService = getInvoiceService();
    const config = await invoiceService.upsertConfig({
      tenant_id: userRole.tenant_id,
      branch_id: body.branch_id || null,
      rfc: body.rfc,
      razon_social: body.razon_social,
      regimen_fiscal: body.regimen_fiscal,
      codigo_postal: body.codigo_postal,
      serie: body.serie || 'FAC',
      folio_actual: body.folio_actual || 0,
      uso_cfdi_default: body.uso_cfdi_default || 'G03',
      forma_pago_default: body.forma_pago_default || '01',
      metodo_pago_default: body.metodo_pago_default || 'PUE',
      moneda_default: body.moneda_default || 'MXN',
      tasa_iva: body.tasa_iva ?? 0.16,
      tasa_ieps: body.tasa_ieps ?? 0,
      pac_provider: body.pac_provider,
      pac_environment: body.pac_environment || 'sandbox',
      pdf_template: body.pdf_template || 'default',
      logo_url: body.logo_url,
      email_from_name: body.email_from_name,
      email_reply_to: body.email_reply_to,
      email_bcc: body.email_bcc,
      auto_send_email: body.auto_send_email ?? true,
      require_rfc_validation: body.require_rfc_validation ?? true,
      allow_generic_rfc: body.allow_generic_rfc ?? true,
      is_active: true,
    });

    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error('Error saving config:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
