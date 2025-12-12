/**
 * TIS TIS - Admin API: Setup User with Tenant
 *
 * Este endpoint configura un usuario existente con un tenant.
 * Uso: POST /api/admin/setup-user
 * Body: { email: string, vertical?: string }
 *
 * IMPORTANTE: Este endpoint solo debe usarse en desarrollo/testing.
 * En producción, el provisioning se hace automáticamente via Stripe webhook.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, vertical = 'dental' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🚀 [SetupUser] Starting setup for:', email);

    const supabase = getSupabaseAdmin();

    // 1. Find the user in auth.users
    const { data: users } = await supabase.auth.admin.listUsers();
    const authUser = users?.users?.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json({ error: 'User not found in auth.users' }, { status: 404 });
    }

    console.log('✅ [SetupUser] Found auth user:', authUser.id);

    // 2. Check if user already has tenant_id in metadata
    if (authUser.user_metadata?.tenant_id) {
      console.log('⚠️ [SetupUser] User already has tenant_id:', authUser.user_metadata.tenant_id);

      // Verify tenant exists
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', authUser.user_metadata.tenant_id)
        .single();

      if (existingTenant) {
        return NextResponse.json({
          success: true,
          message: 'User already configured',
          tenant_id: existingTenant.id,
          tenant_name: existingTenant.name,
        });
      }
    }

    // 3. Check if tenant already exists for this user (by client)
    const { data: existingClient } = await supabase
      .from('clients')
      .select('*, tenants(*)')
      .eq('contact_email', email)
      .single();

    let tenantId: string;
    let tenantName: string;

    if (existingClient?.tenant_id) {
      // Use existing tenant
      tenantId = existingClient.tenant_id;
      tenantName = existingClient.tenants?.name || 'Existing Tenant';
      console.log('✅ [SetupUser] Found existing tenant:', tenantId);
    } else {
      // 4. Create new tenant
      const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');

      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: `Negocio de ${email.split('@')[0]}`,
          slug: `${slug}-${Date.now()}`,
          vertical: vertical,
          plan: 'essentials',
          primary_contact_email: email,
          status: 'active',
          plan_started_at: new Date().toISOString(),
          settings: {
            timezone: 'America/Mexico_City',
            language: 'es',
            currency: 'MXN',
          },
        })
        .select()
        .single();

      if (tenantError) {
        console.error('❌ [SetupUser] Tenant creation error:', tenantError);
        return NextResponse.json({ error: 'Failed to create tenant', details: tenantError }, { status: 500 });
      }

      tenantId = newTenant.id;
      tenantName = newTenant.name;
      console.log('✅ [SetupUser] Created new tenant:', tenantId);

      // 5. Create branch
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .insert({
          tenant_id: tenantId,
          name: 'Sucursal Principal',
          slug: 'principal',
          is_headquarters: true,
          is_active: true,
          timezone: 'America/Mexico_City',
        })
        .select()
        .single();

      if (branchError) {
        console.error('❌ [SetupUser] Branch creation error:', branchError);
      } else {
        console.log('✅ [SetupUser] Created branch:', branch.id);
      }

      // 6. Create or update client
      if (!existingClient) {
        await supabase.from('clients').insert({
          user_id: authUser.id,
          tenant_id: tenantId,
          contact_email: email,
          business_name: tenantName,
          status: 'active',
        });
        console.log('✅ [SetupUser] Created client record');
      } else {
        await supabase
          .from('clients')
          .update({ tenant_id: tenantId, user_id: authUser.id })
          .eq('id', existingClient.id);
        console.log('✅ [SetupUser] Updated client with tenant_id');
      }
    }

    // 7. Create staff record if not exists
    const { data: existingStaff } = await supabase
      .from('staff')
      .select('id')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .single();

    if (!existingStaff) {
      const nameParts = email.split('@')[0].split('.');
      const firstName = nameParts[0]?.charAt(0).toUpperCase() + nameParts[0]?.slice(1) || 'Admin';
      const lastName = nameParts[1]?.charAt(0).toUpperCase() + nameParts[1]?.slice(1) || '';

      const { error: staffError } = await supabase.from('staff').insert({
        tenant_id: tenantId,
        user_id: authUser.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        display_name: `${firstName} ${lastName}`.trim(),
        role: 'admin',
        role_title: 'Administrador',
        is_active: true,
      });

      if (staffError) {
        console.error('❌ [SetupUser] Staff creation error:', staffError);
      } else {
        console.log('✅ [SetupUser] Created staff record');
      }
    } else {
      console.log('✅ [SetupUser] Staff already exists');
    }

    // 8. Update user metadata with tenant_id
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        tenant_id: tenantId,
        role: 'admin',
        vertical: vertical,
      },
    });

    if (updateError) {
      console.error('❌ [SetupUser] Metadata update error:', updateError);
      return NextResponse.json({ error: 'Failed to update user metadata', details: updateError }, { status: 500 });
    }

    console.log('✅ [SetupUser] Updated user metadata with tenant_id');

    // 9. Create some sample data for testing
    await createSampleData(supabase, tenantId);

    return NextResponse.json({
      success: true,
      message: 'User setup complete',
      user_id: authUser.id,
      tenant_id: tenantId,
      tenant_name: tenantName,
      next_steps: [
        '1. Cierra sesión completamente',
        '2. Vuelve a iniciar sesión',
        '3. Ve al dashboard - ahora debería cargar correctamente',
      ],
    });
  } catch (error) {
    console.error('💥 [SetupUser] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Create sample data for testing the dashboard
async function createSampleData(supabase: any, tenantId: string) {
  console.log('📊 [SetupUser] Creating sample data...');

  try {
    // Sample leads
    const leads = [
      { name: 'María García', phone: '+52 55 1234 5678', classification: 'hot', status: 'new', score: 85 },
      { name: 'Juan Pérez', phone: '+52 55 2345 6789', classification: 'warm', status: 'contacted', score: 65 },
      { name: 'Ana López', phone: '+52 55 3456 7890', classification: 'hot', status: 'qualified', score: 90 },
      { name: 'Carlos Ruiz', phone: '+52 55 4567 8901', classification: 'cold', status: 'new', score: 30 },
      { name: 'Laura Martínez', phone: '+52 55 5678 9012', classification: 'warm', status: 'appointment_scheduled', score: 75 },
    ];

    for (const lead of leads) {
      await supabase.from('leads').insert({
        tenant_id: tenantId,
        ...lead,
        source: 'whatsapp',
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    console.log('✅ [SetupUser] Created sample leads');

    // Sample appointments for today
    const today = new Date();
    const appointments = [
      { hour: 9, duration: 30, service: 'Consulta General', status: 'confirmed' },
      { hour: 11, duration: 60, service: 'Limpieza Dental', status: 'scheduled' },
      { hour: 14, duration: 45, service: 'Valoración', status: 'confirmed' },
    ];

    // Get first lead for appointments
    const { data: firstLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    if (firstLead) {
      for (const apt of appointments) {
        const scheduledAt = new Date(today);
        scheduledAt.setHours(apt.hour, 0, 0, 0);

        await supabase.from('appointments').insert({
          tenant_id: tenantId,
          lead_id: firstLead.id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: apt.duration,
          service_name: apt.service,
          status: apt.status,
        });
      }
      console.log('✅ [SetupUser] Created sample appointments');
    }

    // Sample conversations
    await supabase.from('conversations').insert([
      { tenant_id: tenantId, status: 'active', channel: 'whatsapp', last_message_at: new Date().toISOString() },
      { tenant_id: tenantId, status: 'waiting_response', channel: 'whatsapp', last_message_at: new Date().toISOString() },
      { tenant_id: tenantId, status: 'escalated', channel: 'whatsapp', last_message_at: new Date().toISOString() },
    ]);
    console.log('✅ [SetupUser] Created sample conversations');

  } catch (error) {
    console.error('⚠️ [SetupUser] Sample data error (non-critical):', error);
  }
}

// GET endpoint to check user status
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Find user
  const { data: users } = await supabase.auth.admin.listUsers();
  const authUser = users?.users?.find(u => u.email === email);

  if (!authUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get tenant info
  let tenantInfo = null;
  if (authUser.user_metadata?.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', authUser.user_metadata.tenant_id)
      .single();
    tenantInfo = tenant;
  }

  // Get staff info
  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('email', email)
    .single();

  return NextResponse.json({
    user_id: authUser.id,
    email: authUser.email,
    user_metadata: authUser.user_metadata,
    has_tenant_id: !!authUser.user_metadata?.tenant_id,
    tenant: tenantInfo,
    staff: staff,
  });
}
