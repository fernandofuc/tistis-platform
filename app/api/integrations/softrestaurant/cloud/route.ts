// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Cloud API Endpoint
// Handles SR Cloud (SaaS) integration operations
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  getSoftRestaurantCloudService,
  SR_CLOUD_ERROR_CODES,
  type SRCloudConnectionTestResult,
} from '@/src/features/integrations';
import {
  checkRateLimit,
  getClientIP,
  rateLimitExceeded,
  type RateLimitConfig,
} from '@/src/shared/lib/rate-limit';

// ======================
// CONSTANTS
// ======================

/** Rate limiter for SR Cloud API - 20 requests per minute */
const SR_CLOUD_RATE_LIMIT: RateLimitConfig = {
  limit: 20,
  windowSeconds: 60,
  identifier: 'sr-cloud-api',
};

/** UUID v4 regex pattern for validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ======================
// TYPES
// ======================

interface TestConnectionRequest {
  apiKey: string;
  apiBaseUrl?: string;
}

interface SyncMenuRequest {
  apiKey: string;
  apiBaseUrl?: string;
  integrationId: string;
}

// ======================
// VALIDATION HELPERS
// ======================

/**
 * Validates that a string is a valid UUID v4
 */
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validates apiBaseUrl is a safe HTTPS URL (prevent SSRF)
 */
function isValidApiBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS and specific trusted domains
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Whitelist of allowed domains for SR Cloud API
    const allowedDomains = [
      'api.softrestaurant.com.mx',
      'softrestaurant.com.mx',
      'api.nationalsoft.com.mx',
    ];
    return allowedDomains.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// ======================
// POST - Test Connection or Sync Menu
// ======================

/**
 * POST /api/integrations/softrestaurant/cloud
 *
 * Body:
 * - action: 'test_connection' | 'sync_menu'
 * - apiKey: string (required)
 * - apiBaseUrl?: string (optional, defaults to official API)
 * - integrationId?: string (required for sync_menu)
 */
export async function POST(request: NextRequest) {
  // Rate limiting check
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, SR_CLOUD_RATE_LIMIT);
  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { tenantId } = authResult;

  try {
    const body = await request.json();
    const { action, apiBaseUrl } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    // Validate apiBaseUrl if provided (SSRF prevention)
    if (apiBaseUrl && !isValidApiBaseUrl(apiBaseUrl)) {
      return NextResponse.json(
        {
          error: 'Invalid API base URL',
          message: 'La URL de API proporcionada no es válida o no está permitida',
          errorCode: SR_CLOUD_ERROR_CODES.INVALID_API_KEY,
        },
        { status: 400 }
      );
    }

    switch (action) {
      case 'test_connection':
        return handleTestConnection(tenantId, body as TestConnectionRequest);

      case 'sync_menu':
        return handleSyncMenu(tenantId, body as SyncMenuRequest);

      case 'get_limitations':
        return handleGetLimitations();

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    // Sanitize error message to avoid leaking sensitive info
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const sanitizedMessage = errorMessage.replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=[REDACTED]');
    console.error('[SR Cloud API] Error:', sanitizedMessage);

    return NextResponse.json(
      {
        error: 'Error processing request',
        message: 'Se produjo un error al procesar la solicitud',
        errorCode: SR_CLOUD_ERROR_CODES.UNKNOWN_ERROR,
      },
      { status: 500 }
    );
  }
}

// ======================
// ACTION HANDLERS
// ======================

/**
 * Tests connection to SR Cloud API.
 */
async function handleTestConnection(
  tenantId: string,
  body: TestConnectionRequest
): Promise<NextResponse> {
  const { apiKey, apiBaseUrl } = body;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Missing apiKey parameter',
        errorCode: SR_CLOUD_ERROR_CODES.INVALID_API_KEY,
      },
      { status: 400 }
    );
  }

  // Log connection test attempt (without sensitive data)
  console.log(`[SR Cloud API] Test connection for tenant: ${tenantId}`);

  const srCloudService = getSoftRestaurantCloudService();
  const result: SRCloudConnectionTestResult = await srCloudService.testConnection(
    apiKey,
    apiBaseUrl
  );

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.message,
        errorCode: result.errorCode,
        errorDetails: result.errorDetails,
        details: result.details,
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    status: result.status,
    details: result.details,
    // Include limitations for user awareness
    limitations: srCloudService.getCloudLimitations(),
  });
}

/**
 * Syncs menu from SR Cloud.
 */
async function handleSyncMenu(
  tenantId: string,
  body: SyncMenuRequest
): Promise<NextResponse> {
  const { apiKey, apiBaseUrl, integrationId } = body;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Missing apiKey parameter',
        errorCode: SR_CLOUD_ERROR_CODES.INVALID_API_KEY,
      },
      { status: 400 }
    );
  }

  if (!integrationId) {
    return NextResponse.json(
      { error: 'Missing integrationId parameter' },
      { status: 400 }
    );
  }

  // Validate integrationId is a valid UUID (security: prevent injection)
  if (!isValidUUID(integrationId)) {
    return NextResponse.json(
      {
        error: 'Invalid integrationId format',
        message: 'El ID de integración debe ser un UUID válido',
      },
      { status: 400 }
    );
  }

  // Log sync attempt
  console.log(`[SR Cloud API] Menu sync for tenant: ${tenantId}, integration: ${integrationId}`);

  const srCloudService = getSoftRestaurantCloudService();

  // Fetch menu from SR Cloud
  const menuResult = await srCloudService.fetchMenu(apiKey, apiBaseUrl);

  if (!menuResult.success || !menuResult.data) {
    return NextResponse.json(
      {
        success: false,
        error: menuResult.error?.message || 'Failed to fetch menu',
        errorCode: menuResult.error?.code || SR_CLOUD_ERROR_CODES.UNKNOWN_ERROR,
      },
      { status: 400 }
    );
  }

  // TODO: Save menu items to external_products table
  // This requires implementation of the persistence layer
  // For now, return the raw menu data for client-side handling

  return NextResponse.json({
    success: true,
    message: `Sincronizados ${menuResult.data.items.length} productos y ${menuResult.data.categories.length} categorías`,
    data: {
      itemsCount: menuResult.data.items.length,
      categoriesCount: menuResult.data.categories.length,
      lastUpdated: menuResult.data.lastUpdated,
      // Include raw data for client to process if needed
      items: menuResult.data.items,
      categories: menuResult.data.categories,
    },
    // Important: Include limitations so user knows what's NOT available
    limitations: srCloudService.getCloudLimitations(),
  });
}

/**
 * Returns SR Cloud limitations.
 */
function handleGetLimitations(): NextResponse {
  const srCloudService = getSoftRestaurantCloudService();

  return NextResponse.json({
    success: true,
    limitations: srCloudService.getCloudLimitations(),
    availableFeatures: {
      menu: srCloudService.isFeatureAvailable('menu'),
      inventory: srCloudService.isFeatureAvailable('inventory'),
      sales: srCloudService.isFeatureAvailable('sales'),
      tables: srCloudService.isFeatureAvailable('tables'),
      reservations: srCloudService.isFeatureAvailable('reservations'),
      recipes: srCloudService.isFeatureAvailable('recipes'),
    },
    recommendation:
      'Para acceso completo a datos (inventario, ventas detalladas, mesas), ' +
      'recomendamos usar Soft Restaurant Local con el TIS TIS Local Agent.',
  });
}

// ======================
// GET - Check Feature Availability
// ======================

/**
 * GET /api/integrations/softrestaurant/cloud
 *
 * Returns SR Cloud limitations and available features.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  return handleGetLimitations();
}
