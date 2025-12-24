// =====================================================
// TIS TIS PLATFORM - Global Search API
// Búsqueda unificada en leads, pacientes y citas
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create authenticated Supabase client
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

// Extract Bearer token
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

// Search result type
interface SearchResult {
  id: string;
  type: 'lead' | 'patient' | 'appointment';
  title: string;
  subtitle: string;
  url: string;
  metadata?: Record<string, unknown>;
}

// ======================
// GET - Global Search
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
        message: 'Se requieren al menos 2 caracteres para buscar',
      });
    }

    // Use wildcard pattern for PostgREST ilike
    const searchPattern = `*${query}*`;
    const results: SearchResult[] = [];

    // Search in Leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, full_name, first_name, last_name, phone, email, classification, status')
      .eq('tenant_id', tenantId)
      .or(`full_name.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .limit(limit);

    if (leadsError) {
      console.error('[Search API] Leads error:', leadsError);
    }

    if (leads && leads.length > 0) {
      for (const lead of leads) {
        const name = lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Sin nombre';
        results.push({
          id: lead.id,
          type: 'lead',
          title: name,
          subtitle: lead.phone || lead.email || `Lead - ${lead.classification || 'Sin clasificar'}`,
          url: `/dashboard/leads?selected=${lead.id}`,
          metadata: {
            classification: lead.classification,
            status: lead.status,
          },
        });
      }
    }

    // Search in Patients
    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, full_name, first_name, last_name, phone, email')
      .eq('tenant_id', tenantId)
      .or(`full_name.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .limit(limit);

    if (patientsError) {
      console.error('[Search API] Patients error:', patientsError);
    }

    if (patients && patients.length > 0) {
      for (const patient of patients) {
        const name = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Sin nombre';
        results.push({
          id: patient.id,
          type: 'patient',
          title: name,
          subtitle: patient.phone || patient.email || 'Paciente',
          url: `/dashboard/patients/${patient.id}`,
        });
      }
    }

    // Search in Appointments (simplified - search by notes only, get patient data separately)
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        start_time,
        status,
        notes,
        patient_id,
        patients(full_name, first_name, last_name)
      `)
      .eq('tenant_id', tenantId)
      .ilike('notes', searchPattern)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(limit);

    if (appointmentsError) {
      console.error('[Search API] Appointments error:', appointmentsError);
    }

    if (appointments && appointments.length > 0) {
      for (const apt of appointments) {
        const patient = apt.patients as { full_name?: string; first_name?: string; last_name?: string } | null;
        const patientName = patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'Sin paciente';
        const date = new Date(apt.start_time);
        const formattedDate = date.toLocaleDateString('es-MX', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        results.push({
          id: apt.id,
          type: 'appointment',
          title: `Cita: ${patientName}`,
          subtitle: formattedDate,
          url: `/dashboard/agenda?date=${date.toISOString().split('T')[0]}&selected=${apt.id}`,
          metadata: {
            status: apt.status,
          },
        });
      }
    }

    // Sort results: prioritize exact matches and recent items
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      const bExact = b.title.toLowerCase().includes(query.toLowerCase()) ? 0 : 1;
      return aExact - bExact;
    });

    return NextResponse.json({
      success: true,
      results: results.slice(0, limit),
      total: results.length,
    });
  } catch (error) {
    console.error('[Global Search API] Error:', error);
    return NextResponse.json(
      { error: 'Error en la búsqueda' },
      { status: 500 }
    );
  }
}
