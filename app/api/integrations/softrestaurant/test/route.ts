// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Connection Test API
// Tests connection to Soft Restaurant API with provided credentials
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  testSoftRestaurantConnection,
  SR_ERROR_CODES,
} from '@/src/features/integrations/services/soft-restaurant-api.service';
import {
  checkRateLimit,
  getClientIP,
  addRateLimitHeaders,
} from '@/src/shared/lib/rate-limit';

// ======================
// RATE LIMITER CONFIG
// ======================

const SR_TEST_LIMITER = {
  limit: 10,            // 10 requests
  windowSeconds: 60,    // per minute
  identifier: 'sr-connection-test',
};

// ======================
// POST - Test Connection
// ======================

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, SR_TEST_LIMITER);

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          message: 'Demasiadas solicitudes. Espera un momento antes de intentar de nuevo.',
          errorCode: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, retryAfterSeconds)),
          },
        }
      );
    }

    // Authentication
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { role } = authResult;

    // Check permissions - only owner/admin can test integrations
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Solo administradores pueden probar integraciones',
          errorCode: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { api_key } = body;

    // Validate API key presence
    if (!api_key || typeof api_key !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'API Key es requerida',
          errorCode: SR_ERROR_CODES.INVALID_API_KEY,
        },
        { status: 400 }
      );
    }

    // Test connection with Soft Restaurant API
    console.log('[SR Test API] Testing connection...');
    const result = await testSoftRestaurantConnection(api_key);

    // Log result (without sensitive data)
    console.log('[SR Test API] Connection test result:', {
      success: result.success,
      errorCode: result.errorCode,
      hasDetails: !!result.details,
    });

    // Return result with appropriate status code
    const statusCode = result.success ? 200 : 400;

    const response = NextResponse.json(result, { status: statusCode });
    return addRateLimitHeaders(response, rateLimitResult);

  } catch (error) {
    console.error('[SR Test API] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Error interno del servidor',
        errorCode: SR_ERROR_CODES.UNKNOWN_ERROR,
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
