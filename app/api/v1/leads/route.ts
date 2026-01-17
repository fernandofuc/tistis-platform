// =====================================================
// TIS TIS PLATFORM - Public API: Leads
// API Key authenticated endpoint for leads management
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateAPIKey,
  createAPIKeyErrorResponse,
  createAPIKeyAuthenticatedClient,
} from '@/src/shared/lib/api-key-auth';
import {
  applyRateLimit,
  addRateLimitHeaders,
  createRateLimitExceededResponse,
} from '@/src/shared/lib/api-key-rate-limit';
import { logRequest } from '@/src/shared/lib/api-key-logger';
import type { APIScope } from '@/src/features/api-settings/types';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface Lead {
  id: string;
  tenant_id: string;
  phone: string;
  name?: string;
  email?: string;
  source?: string;
  status: string;
  classification?: string;
  created_at: string;
  updated_at: string;
}

interface LeadsListResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

interface CreateLeadRequest {
  phone: string;
  name?: string;
  email?: string;
  source?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

function getClientIP(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

// ======================
// GET /api/v1/leads
// List leads with pagination
// Required scope: leads:read
// ======================
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  // 1. Authenticate API Key
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'leads:read' as APIScope,
  });

  if (!auth.success) {
    logRequest({
      keyId: auth.keyId || 'unknown',
      tenantId: auth.tenantId || 'unknown',
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: auth.statusCode || 401,
      responseTimeMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      errorMessage: auth.error,
    });
    return createAPIKeyErrorResponse(auth);
  }

  // 2. Check rate limit
  const rateLimit = await applyRateLimit(auth.keyId!, auth.rateLimits!);

  if (!rateLimit.allowed) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 429,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
      errorMessage: 'Rate limit exceeded',
    });
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    // 3. Parse and validate query parameters
    const url = new URL(request.url);
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(url.searchParams.get('pageSize') || '20', 10);

    // Ensure valid numbers with sensible defaults
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const pageSize = isNaN(pageSizeParam) || pageSizeParam < 1
      ? 20
      : Math.min(pageSizeParam, 100); // Max 100 per page

    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    // 4. Query leads from database
    const supabase = createAPIKeyAuthenticatedClient();

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('tenant_id', auth.tenantId!)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      // Sanitize search input to prevent injection
      // Supabase's .or() with template literals is safe when using PostgREST syntax,
      // but we still sanitize special characters for defense in depth
      const sanitizedSearch = search
        .replace(/[%_\\]/g, '\\$&') // Escape LIKE special chars
        .replace(/['"]/g, ''); // Remove quotes
      query = query.or(
        `name.ilike.%${sanitizedSearch}%,phone.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`
      );
    }

    const { data: leads, error, count } = await query;

    if (error) {
      console.error('[API v1/leads] Database error:', error);
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'GET',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:read',
        ipAddress,
        userAgent,
        errorMessage: error.message,
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Failed to fetch leads', code: 'DATABASE_ERROR' },
          { status: 500 }
        ),
        rateLimit
      );
    }

    // 5. Build response
    const response: LeadsListResponse = {
      data: leads || [],
      total: count || 0,
      page,
      pageSize,
    };

    // 6. Log successful request
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
    });

    return addRateLimitHeaders(NextResponse.json(response), rateLimit);
  } catch (error) {
    console.error('[API v1/leads] Unexpected error:', error);
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'GET',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:read',
      ipAddress,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return addRateLimitHeaders(
      NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      ),
      rateLimit
    );
  }
}

// ======================
// POST /api/v1/leads
// Create a new lead
// Required scope: leads:write
// ======================
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  // 1. Authenticate API Key
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'leads:write' as APIScope,
  });

  if (!auth.success) {
    logRequest({
      keyId: auth.keyId || 'unknown',
      tenantId: auth.tenantId || 'unknown',
      endpoint: '/api/v1/leads',
      method: 'POST',
      statusCode: auth.statusCode || 401,
      responseTimeMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      errorMessage: auth.error,
    });
    return createAPIKeyErrorResponse(auth);
  }

  // 2. Check rate limit
  const rateLimit = await applyRateLimit(auth.keyId!, auth.rateLimits!);

  if (!rateLimit.allowed) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'POST',
      statusCode: 429,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:write',
      ipAddress,
      userAgent,
      errorMessage: 'Rate limit exceeded',
    });
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    // 3. Parse request body
    let body: CreateLeadRequest;
    try {
      body = await request.json();
    } catch {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'POST',
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:write',
        ipAddress,
        userAgent,
        errorMessage: 'Invalid JSON body',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Invalid request body', code: 'INVALID_JSON' },
          { status: 400 }
        ),
        rateLimit
      );
    }

    // 4. Validate required fields
    if (!body.phone || typeof body.phone !== 'string') {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'POST',
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:write',
        ipAddress,
        userAgent,
        errorMessage: 'Phone is required',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Phone number is required', code: 'VALIDATION_ERROR' },
          { status: 400 }
        ),
        rateLimit
      );
    }

    // Sanitize and validate phone format (basic validation)
    const sanitizedPhone = body.phone.trim().replace(/\s+/g, '');
    if (sanitizedPhone.length < 7 || sanitizedPhone.length > 20) {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'POST',
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:write',
        ipAddress,
        userAgent,
        errorMessage: 'Invalid phone format',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Invalid phone number format', code: 'VALIDATION_ERROR' },
          { status: 400 }
        ),
        rateLimit
      );
    }

    // 5. Check for existing lead with same phone
    const supabase = createAPIKeyAuthenticatedClient();

    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', auth.tenantId!)
      .eq('phone', sanitizedPhone)
      .single();

    if (existingLead) {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'POST',
        statusCode: 409,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:write',
        ipAddress,
        userAgent,
        errorMessage: 'Lead already exists',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          {
            error: 'A lead with this phone number already exists',
            code: 'DUPLICATE_LEAD',
            existing_id: existingLead.id,
          },
          { status: 409 }
        ),
        rateLimit
      );
    }

    // 6. Create the lead
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        tenant_id: auth.tenantId!,
        phone: sanitizedPhone,
        name: body.name?.trim() || null,
        email: body.email?.trim().toLowerCase() || null,
        source: body.source?.trim() || 'api',
        status: 'new',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[API v1/leads] Insert error:', insertError);
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: '/api/v1/leads',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'leads:write',
        ipAddress,
        userAgent,
        errorMessage: insertError.message,
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Failed to create lead', code: 'DATABASE_ERROR' },
          { status: 500 }
        ),
        rateLimit
      );
    }

    // 7. Log successful request
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'POST',
      statusCode: 201,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:write',
      ipAddress,
      userAgent,
    });

    return addRateLimitHeaders(
      NextResponse.json({ data: newLead }, { status: 201 }),
      rateLimit
    );
  } catch (error) {
    console.error('[API v1/leads] Unexpected error:', error);
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: '/api/v1/leads',
      method: 'POST',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'leads:write',
      ipAddress,
      userAgent,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    return addRateLimitHeaders(
      NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      ),
      rateLimit
    );
  }
}
