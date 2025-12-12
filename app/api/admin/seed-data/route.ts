/**
 * TIS TIS - Admin API: Seed Sample Data
 *
 * Este endpoint crea datos de ejemplo para un tenant específico.
 * Uso: POST /api/admin/seed-data
 * Body: { tenant_id: string }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    console.log('🌱 [SeedData] Creating sample data for tenant:', tenant_id);

    const supabase = getSupabaseAdmin();

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Delete existing sample data first
    await supabase.from('appointments').delete().eq('tenant_id', tenant_id);
    await supabase.from('leads').delete().eq('tenant_id', tenant_id);
    await supabase.from('conversations').delete().eq('tenant_id', tenant_id);

    console.log('🗑️ [SeedData] Cleared existing data');

    // Create leads
    const leadsData = [
      {
        tenant_id,
        name: 'María García López',
        phone: '+52 55 1234 5678',
        email: 'maria.garcia@email.com',
        classification: 'hot',
        status: 'qualified',
        score: 92,
        source: 'whatsapp',
        notes: 'Interesada en tratamiento completo. Ya agendó valoración.',
      },
      {
        tenant_id,
        name: 'Juan Carlos Pérez',
        phone: '+52 55 2345 6789',
        email: 'juancarlos@email.com',
        classification: 'hot',
        status: 'appointment_scheduled',
        score: 88,
        source: 'whatsapp',
        notes: 'Referido por María. Viene mañana.',
      },
      {
        tenant_id,
        name: 'Ana Sofía Rodríguez',
        phone: '+52 55 3456 7890',
        classification: 'warm',
        status: 'contacted',
        score: 65,
        source: 'instagram',
        notes: 'Preguntó por precios de limpieza.',
      },
      {
        tenant_id,
        name: 'Roberto Hernández',
        phone: '+52 55 4567 8901',
        classification: 'warm',
        status: 'new',
        score: 55,
        source: 'whatsapp',
        notes: 'Primer mensaje hace 2 horas.',
      },
      {
        tenant_id,
        name: 'Laura Martínez',
        phone: '+52 55 5678 9012',
        classification: 'cold',
        status: 'contacted',
        score: 30,
        source: 'website',
        notes: 'Solo pidió información general.',
      },
      {
        tenant_id,
        name: 'Carlos Sánchez',
        phone: '+52 55 6789 0123',
        classification: 'hot',
        status: 'qualified',
        score: 85,
        source: 'referral',
        notes: 'Quiere presupuesto urgente para implantes.',
      },
    ];

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .insert(leadsData)
      .select();

    if (leadsError) {
      console.error('❌ [SeedData] Error creating leads:', leadsError);
      return NextResponse.json({ error: 'Error creating leads', details: leadsError }, { status: 500 });
    }

    console.log('✅ [SeedData] Created', leads?.length, 'leads');

    // Create appointments for today
    const today = new Date();
    const appointmentsData = leads?.slice(0, 4).map((lead, index) => {
      const scheduledAt = new Date(today);
      scheduledAt.setHours(9 + index * 2, 0, 0, 0);

      return {
        tenant_id,
        lead_id: lead.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: index === 0 ? 60 : 30,
        service_name: ['Valoración Inicial', 'Limpieza Dental', 'Consulta General', 'Revisión'][index],
        status: index < 2 ? 'confirmed' : 'scheduled',
        notes: index === 0 ? 'Primera cita - evaluar tratamiento' : undefined,
      };
    }) || [];

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .insert(appointmentsData)
      .select();

    if (appointmentsError) {
      console.error('❌ [SeedData] Error creating appointments:', appointmentsError);
    } else {
      console.log('✅ [SeedData] Created', appointments?.length, 'appointments');
    }

    // Create conversations
    const conversationsData = [
      {
        tenant_id,
        lead_id: leads?.[0]?.id,
        status: 'active',
        channel: 'whatsapp',
        last_message_at: new Date().toISOString(),
        last_message_preview: 'Perfecto, nos vemos mañana entonces',
        unread_count: 0,
      },
      {
        tenant_id,
        lead_id: leads?.[1]?.id,
        status: 'waiting_response',
        channel: 'whatsapp',
        last_message_at: new Date(Date.now() - 30 * 60000).toISOString(),
        last_message_preview: '¿Cuánto cuesta una limpieza?',
        unread_count: 1,
      },
      {
        tenant_id,
        lead_id: leads?.[3]?.id,
        status: 'escalated',
        channel: 'whatsapp',
        last_message_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        last_message_preview: 'Necesito hablar con alguien urgente',
        unread_count: 3,
      },
      {
        tenant_id,
        lead_id: leads?.[2]?.id,
        status: 'active',
        channel: 'instagram',
        last_message_at: new Date(Date.now() - 15 * 60000).toISOString(),
        last_message_preview: 'Gracias por la información',
        unread_count: 0,
      },
    ];

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .insert(conversationsData)
      .select();

    if (conversationsError) {
      console.error('❌ [SeedData] Error creating conversations:', conversationsError);
    } else {
      console.log('✅ [SeedData] Created', conversations?.length, 'conversations');
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      data: {
        leads: leads?.length || 0,
        appointments: appointments?.length || 0,
        conversations: conversations?.length || 0,
      },
      next_steps: [
        '1. Refresca el dashboard',
        '2. Deberías ver leads, citas y conversaciones',
      ],
    });
  } catch (error) {
    console.error('💥 [SeedData] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET endpoint to see current data count
export async function GET(req: NextRequest) {
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
