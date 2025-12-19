// =====================================================
// TIS TIS PLATFORM - Leads API Route
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/src/shared/lib/supabase';

const ESVA_TENANT_ID = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

// ======================
// GET - Fetch leads
// ======================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    // Parse query params
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const classification = searchParams.get('classification');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let query = supabase
      .from('leads')
      .select('*, branches(name, city)', { count: 'exact' })
      .eq('tenant_id', ESVA_TENANT_ID);

    // Apply filters
    if (classification) {
      query = query.eq('classification', classification);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      // Use * wildcard for more reliable PostgREST pattern matching
      // Search in full_name, first_name, last_name (not "name" which doesn't exist)
      const pattern = `*${search}*`;
      query = query.or(`full_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create lead
// ======================
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    // Validate required fields
    if (!body.phone) {
      return NextResponse.json(
        { error: 'Phone is required' },
        { status: 400 }
      );
    }

    // Normalize phone
    let normalizedPhone = body.phone.replace(/[^\d+]/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+52${normalizedPhone}`;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('52')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Check if lead exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', ESVA_TENANT_ID)
      .eq('phone_normalized', normalizedPhone)
      .single();

    if (existingLead) {
      return NextResponse.json(
        { error: 'Lead already exists', leadId: existingLead.id },
        { status: 409 }
      );
    }

    // Parse name into first_name and last_name
    const fullName = body.name || body.full_name || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // Create lead
    const leadData = {
      tenant_id: ESVA_TENANT_ID,
      phone: body.phone,
      phone_normalized: normalizedPhone,
      first_name: body.first_name || firstName,
      last_name: body.last_name || lastName,
      full_name: fullName || null,
      email: body.email || null,
      source: body.source || 'website',
      status: 'new',
      classification: 'warm',
      score: 50,
      interested_services: body.interested_services || [],
      branch_id: body.branch_id || null,
      notes: body.notes || null,
      tags: body.tags || [],
    };

    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
