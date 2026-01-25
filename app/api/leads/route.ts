// =====================================================
// TIS TIS PLATFORM - Leads API Route
// With Zod Validation (Sprint 3)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateRequest,
  validateQueryParams,
  checkValidation,
  validationErrorResponse,
} from '@/src/lib/api/zod-validation';
import { leadCreateSchema, leadListQuerySchema } from '@/src/shared/schemas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Get authenticated context with tenant validation
async function getAuthenticatedContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: userRole, error: roleError } = await serviceClient
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    return { error: 'User has no assigned role', status: 403 };
  }

  return {
    client: serviceClient,
    user,
    tenantId: userRole.tenant_id,
    role: userRole.role,
  };
}

// ======================
// GET - Fetch leads
// ======================
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId } = authContext;

    // Validate query parameters with Zod
    const queryValidation = validateQueryParams(request, leadListQuerySchema);
    if (!queryValidation.success) {
      return validationErrorResponse(queryValidation.errors);
    }

    const {
      page,
      pageSize,
      search,
      classification,
      status,
      sortBy: requestedSortBy,
      sortOrder,
    } = queryValidation.data;

    // Additional params not in standard schema
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('include_deleted') === 'true';
    const onlyDeleted = searchParams.get('only_deleted') === 'true';

    // Allowlist of valid sort columns (prevent SQL injection)
    const ALLOWED_SORT_COLUMNS = ['score', 'created_at', 'status', 'classification', 'first_name', 'last_name', 'full_name', 'updated_at', 'deleted_at'];
    const sortBy = requestedSortBy && ALLOWED_SORT_COLUMNS.includes(requestedSortBy) ? requestedSortBy : 'score';

    // Build query - use authenticated user's tenant
    let query = supabase
      .from('leads')
      .select('*, branches(name, city)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Handle deleted leads filtering
    if (onlyDeleted) {
      // Show only deleted leads (trash view)
      query = query.not('deleted_at', 'is', null);
    } else if (!includeDeleted) {
      // Default: exclude deleted leads
      query = query.is('deleted_at', null);
    }
    // If include_deleted=true, we show all (no filter on deleted_at)

    // Apply filters
    if (classification) {
      query = query.eq('classification', classification);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      // Sanitize search input to prevent PostgREST filter injection
      // Escape special characters used in PostgREST patterns
      const sanitizedSearch = search.replace(/[%_*\\]/g, '\\$&');
      // Use * wildcard for more reliable PostgREST pattern matching
      // Search in full_name, first_name, last_name (not "name" which doesn't exist)
      const pattern = `*${sanitizedSearch}*`;
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
        { error: 'Failed to fetch leads' },
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
    const authContext = await getAuthenticatedContext(request);

    if ('error' in authContext) {
      return NextResponse.json(
        { error: authContext.error },
        { status: authContext.status }
      );
    }

    const { client: supabase, tenantId } = authContext;

    // Validate request body with Zod
    const validation = await validateRequest(request, leadCreateSchema);
    const validationResult = checkValidation(validation);
    if (validationResult instanceof NextResponse) return validationResult;

    const body = validationResult;

    // Normalize phone (already validated by Zod)
    let normalizedPhone = body.phone.replace(/[^\d+]/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+52${normalizedPhone}`;
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('52')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Check if lead exists in this tenant (including soft-deleted)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('phone_normalized', normalizedPhone)
      .single();

    if (existingLead) {
      if (existingLead.deleted_at) {
        // Lead was soft-deleted, suggest restoration
        return NextResponse.json(
          {
            error: 'A deleted lead with this phone exists. You can restore it instead.',
            leadId: existingLead.id,
            canRestore: true
          },
          { status: 409 }
        );
      }
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

    // Create lead with authenticated user's tenant
    const leadData = {
      tenant_id: tenantId,
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
        { error: 'Failed to create lead' },
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
