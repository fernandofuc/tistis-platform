/**
 * TIS TIS - Admin API: Seed Sample Data
 *
 * Este endpoint crea datos de ejemplo para un tenant específico.
 * Uso: POST /api/admin/seed-data
 * Headers: x-admin-key: <ADMIN_API_KEY>
 * Body: { tenant_id: string }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Verify admin API key (timing-safe)
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin API] ADMIN_API_KEY not configured in production');
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
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    console.log('🌱 [SeedData] Creating sample data for tenant:', tenant_id);

    const supabase = getSupabaseAdmin();

    // Verify tenant exists and get a branch
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get a branch for this tenant (required for appointments)
    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenant_id)
      .limit(1);

    const branchId = branches?.[0]?.id;

    if (!branchId) {
      return NextResponse.json({
        error: 'No branch found for tenant. Please create a branch first.',
        hint: 'Run the setup-user endpoint first to ensure branches are created.'
      }, { status: 400 });
    }

    // Delete existing sample data first (order matters due to FK constraints)
    await supabase.from('conversations').delete().eq('tenant_id', tenant_id);
    await supabase.from('appointments').delete().eq('tenant_id', tenant_id);
    await supabase.from('leads').delete().eq('tenant_id', tenant_id);

    console.log('🗑️ [SeedData] Cleared existing data');

    // Create leads (usando valores en minúsculas según CHECK constraints)
    const leadsData = [
      {
        tenant_id,
        first_name: 'María',
        last_name: 'García López',
        phone: '+52 55 1234 5678',
        email: 'maria.garcia@email.com',
        classification: 'hot',
        status: 'qualified',
        score: 92,
        source: 'whatsapp',
      },
      {
        tenant_id,
        first_name: 'Juan Carlos',
        last_name: 'Pérez',
        phone: '+52 55 2345 6789',
        email: 'juancarlos@email.com',
        classification: 'hot',
        status: 'appointment_scheduled',
        score: 88,
        source: 'whatsapp',
      },
      {
        tenant_id,
        first_name: 'Ana Sofía',
        last_name: 'Rodríguez',
        phone: '+52 55 3456 7890',
        classification: 'warm',
        status: 'contacted',
        score: 65,
        source: 'instagram',
      },
      {
        tenant_id,
        first_name: 'Roberto',
        last_name: 'Hernández',
        phone: '+52 55 4567 8901',
        classification: 'warm',
        status: 'new',
        score: 55,
        source: 'whatsapp',
      },
      {
        tenant_id,
        first_name: 'Laura',
        last_name: 'Martínez',
        phone: '+52 55 5678 9012',
        classification: 'cold',
        status: 'contacted',
        score: 30,
        source: 'website',
      },
      {
        tenant_id,
        first_name: 'Carlos',
        last_name: 'Sánchez',
        phone: '+52 55 6789 0123',
        classification: 'hot',
        status: 'qualified',
        score: 85,
        source: 'referral',
      },
    ];

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .insert(leadsData)
      .select();

    if (leadsError) {
      console.error('❌ [SeedData] Error creating leads:', leadsError);
      return NextResponse.json({ error: 'Error creating leads' }, { status: 500 });
    }

    console.log('✅ [SeedData] Created', leads?.length, 'leads');

    // Create appointments for today (usando schema 012_CONSOLIDATED_SCHEMA.sql)
    const today = new Date();
    let appointmentsCreated = 0;

    if (leads && leads.length > 0) {
      const appointmentsData = leads.slice(0, 4).map((lead, index) => {
        const scheduledAt = new Date(today);
        scheduledAt.setHours(9 + index * 2, 0, 0, 0);

        return {
          tenant_id,
          branch_id: branchId,
          lead_id: lead.id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: index === 0 ? 60 : 30,
          status: index < 2 ? 'confirmed' : 'scheduled',
          notes: index === 0 ? 'Primera cita - evaluar tratamiento' : null,
        };
      });

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .insert(appointmentsData)
        .select();

      if (appointmentsError) {
        console.error('❌ [SeedData] Error creating appointments:', appointmentsError);
        // Continue with conversations even if appointments fail
      } else {
        appointmentsCreated = appointments?.length || 0;
        console.log('✅ [SeedData] Created', appointmentsCreated, 'appointments');
      }
    }

    // Create conversations (usando schema 012_CONSOLIDATED_SCHEMA.sql)
    let conversationsCreated = 0;

    if (leads && leads.length > 0) {
      const conversationsData = [
        {
          tenant_id,
          branch_id: branchId,
          lead_id: leads[0]?.id,
          status: 'active',
          channel: 'whatsapp',
          ai_handling: true,
        },
        {
          tenant_id,
          branch_id: branchId,
          lead_id: leads[1]?.id,
          status: 'waiting_response',
          channel: 'whatsapp',
          ai_handling: true,
        },
        {
          tenant_id,
          branch_id: branchId,
          lead_id: leads[3]?.id,
          status: 'escalated',
          channel: 'whatsapp',
          ai_handling: false,
          escalation_reason: 'Cliente solicita hablar con humano',
        },
        {
          tenant_id,
          branch_id: branchId,
          lead_id: leads[2]?.id,
          status: 'active',
          channel: 'instagram',
          ai_handling: true,
        },
      ].filter(c => c.lead_id); // Only include if lead exists

      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .insert(conversationsData)
        .select();

      if (conversationsError) {
        console.error('❌ [SeedData] Error creating conversations:', conversationsError);
      } else {
        conversationsCreated = conversations?.length || 0;
        console.log('✅ [SeedData] Created', conversationsCreated, 'conversations');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      data: {
        leads: leads?.length || 0,
        appointments: appointmentsCreated,
        conversations: conversationsCreated,
      },
      next_steps: [
        '1. Refresca el dashboard',
        '2. Deberías ver leads, citas y conversaciones',
      ],
    });
  } catch (error) {
    console.error('💥 [SeedData] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error' },
      { status: 500 }
    );
  }
}

// GET endpoint to see current data count
export async function GET(req: NextRequest) {
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant_id = req.nextUrl.searchParams.get('tenant_id');

  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id parameter required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const [leadsResult, appointmentsResult, conversationsResult] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
    supabase.from('appointments').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
    supabase.from('conversations').select('id', { count: 'exact' }).eq('tenant_id', tenant_id),
  ]);

  return NextResponse.json({
    tenant_id,
    counts: {
      leads: leadsResult.count || 0,
      appointments: appointmentsResult.count || 0,
      conversations: conversationsResult.count || 0,
    },
  });
}
