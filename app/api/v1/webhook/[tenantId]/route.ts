// =====================================================
// TIS TIS PLATFORM - Webhook Endpoint
// Receives incoming webhook events from external systems
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

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
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

function isValidWebhookPayload(body: unknown): body is WebhookPayload {
  if (!body || typeof body !== 'object') return false;
  const payload = body as Record<string, unknown>;
  return (
    typeof payload.event === 'string' &&
    payload.event.length > 0 &&
    typeof payload.data === 'object' &&
    payload.data !== null
  );
}

// ======================
// POST /api/v1/webhook/[tenantId]
// Receive webhook events
// Required scope: webhook:write
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const startTime = Date.now();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;
  const { tenantId } = await params;

  // 1. Authenticate API Key
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'webhook:write' as APIScope,
  });

  if (!auth.success) {
    logRequest({
      keyId: auth.keyId || 'unknown',
      tenantId: auth.tenantId || tenantId,
      endpoint: `/api/v1/webhook/${tenantId}`,
      method: 'POST',
      statusCode: auth.statusCode || 401,
      responseTimeMs: Date.now() - startTime,
      ipAddress,
      userAgent,
      errorMessage: auth.error,
    });
    return createAPIKeyErrorResponse(auth);
  }

  // 2. Verify tenant matches
  if (auth.tenantId !== tenantId) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: `/api/v1/webhook/${tenantId}`,
      method: 'POST',
      statusCode: 403,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'webhook:write',
      ipAddress,
      userAgent,
      errorMessage: 'Tenant mismatch',
    });
    return NextResponse.json(
      { error: 'Unauthorized: tenant mismatch', code: 'TENANT_MISMATCH' },
      { status: 403 }
    );
  }

  // 3. Check rate limit
  const rateLimit = await applyRateLimit(auth.keyId!, auth.rateLimits!);

  if (!rateLimit.allowed) {
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: `/api/v1/webhook/${tenantId}`,
      method: 'POST',
      statusCode: 429,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'webhook:write',
      ipAddress,
      userAgent,
      errorMessage: 'Rate limit exceeded',
    });
    return createRateLimitExceededResponse(rateLimit);
  }

  try {
    // 4. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: `/api/v1/webhook/${tenantId}`,
        method: 'POST',
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'webhook:write',
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

    // 5. Validate webhook payload
    if (!isValidWebhookPayload(body)) {
      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: `/api/v1/webhook/${tenantId}`,
        method: 'POST',
        statusCode: 400,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'webhook:write',
        ipAddress,
        userAgent,
        errorMessage: 'Invalid webhook payload',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          {
            error: 'Invalid webhook payload. Required: { event: string, data: object }',
            code: 'INVALID_PAYLOAD',
          },
          { status: 400 }
        ),
        rateLimit
      );
    }

    // 6. Store webhook event in database
    const supabase = createAPIKeyAuthenticatedClient();

    const { data: webhookEvent, error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        tenant_id: tenantId,
        api_key_id: auth.keyId,
        event_type: body.event,
        payload: body.data,
        source_ip: ipAddress,
        received_at: new Date().toISOString(),
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      // Log error but don't expose internal details
      console.error('[Webhook] Insert error:', insertError);

      // If table doesn't exist, still acknowledge the webhook
      if (insertError.code === '42P01') {
        // Table doesn't exist - acknowledge anyway for forward compatibility
        logRequest({
          keyId: auth.keyId!,
          tenantId: auth.tenantId!,
          endpoint: `/api/v1/webhook/${tenantId}`,
          method: 'POST',
          statusCode: 202,
          responseTimeMs: Date.now() - startTime,
          scopeUsed: 'webhook:write',
          ipAddress,
          userAgent,
        });
        return addRateLimitHeaders(
          NextResponse.json(
            {
              received: true,
              event: body.event,
              message: 'Webhook received (storage pending setup)',
            },
            { status: 202 }
          ),
          rateLimit
        );
      }

      logRequest({
        keyId: auth.keyId!,
        tenantId: auth.tenantId!,
        endpoint: `/api/v1/webhook/${tenantId}`,
        method: 'POST',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        scopeUsed: 'webhook:write',
        ipAddress,
        userAgent,
        errorMessage: 'Failed to store webhook',
      });
      return addRateLimitHeaders(
        NextResponse.json(
          { error: 'Failed to process webhook', code: 'STORAGE_ERROR' },
          { status: 500 }
        ),
        rateLimit
      );
    }

    // 7. Log successful request
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: `/api/v1/webhook/${tenantId}`,
      method: 'POST',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'webhook:write',
      ipAddress,
      userAgent,
    });

    return addRateLimitHeaders(
      NextResponse.json({
        received: true,
        id: webhookEvent.id,
        event: body.event,
      }),
      rateLimit
    );
  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    logRequest({
      keyId: auth.keyId!,
      tenantId: auth.tenantId!,
      endpoint: `/api/v1/webhook/${tenantId}`,
      method: 'POST',
      statusCode: 500,
      responseTimeMs: Date.now() - startTime,
      scopeUsed: 'webhook:write',
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
// GET /api/v1/webhook/[tenantId]
// Health check / info endpoint (requires authentication)
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  // Require authentication to prevent tenant enumeration
  const auth = await authenticateAPIKey(request, {
    requiredScope: 'webhook:read' as APIScope,
  });

  if (!auth.success) {
    return createAPIKeyErrorResponse(auth);
  }

  // Verify tenant matches
  if (auth.tenantId !== tenantId) {
    return NextResponse.json(
      { error: 'Unauthorized: tenant mismatch', code: 'TENANT_MISMATCH' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    tenant_id: tenantId,
    message: 'Webhook endpoint ready. Send POST requests with your API key.',
    expected_payload: {
      event: 'string (required)',
      data: 'object (required)',
      timestamp: 'string (optional)',
    },
  });
}
