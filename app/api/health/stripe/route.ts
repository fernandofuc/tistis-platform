// =====================================================
// TIS TIS PLATFORM - Stripe Health Check Endpoint
// Returns Stripe and Stripe Connect configuration status
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  checkStripeConnectHealth,
  getConnectErrorDetails,
} from '@/src/features/payments/services';

export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface StripeHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    stripe_api: {
      configured: boolean;
      status: 'healthy' | 'unhealthy';
    };
    stripe_connect: {
      enabled: boolean;
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      action_url?: string;
    };
    webhook: {
      configured: boolean;
      status: 'healthy' | 'degraded';
    };
  };
}

// ======================
// GET - Health Check
// ======================

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Check Stripe Connect health
    const connectHealth = await checkStripeConnectHealth(forceRefresh);
    const errorDetails = getConnectErrorDetails(connectHealth);

    // Determine Stripe API status
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const stripeApiStatus: 'healthy' | 'unhealthy' = stripeConfigured ? 'healthy' : 'unhealthy';

    // Determine Connect status
    let connectStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!connectHealth.isConnectEnabled) {
      connectStatus = 'degraded'; // Degraded because the platform works, but Connect doesn't
    }
    if (!connectHealth.isConfigured) {
      connectStatus = 'unhealthy';
    }

    // Determine webhook status
    const webhookConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
    const webhookStatus: 'healthy' | 'degraded' = webhookConfigured ? 'healthy' : 'degraded';

    // Overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (connectStatus === 'degraded' || webhookStatus === 'degraded') {
      overallStatus = 'degraded';
    }
    if (stripeApiStatus === 'unhealthy' || connectStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    }

    const response: StripeHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        stripe_api: {
          configured: stripeConfigured,
          status: stripeApiStatus,
        },
        stripe_connect: {
          enabled: connectHealth.isConnectEnabled,
          status: connectStatus,
          message: connectHealth.errorMessage,
          action_url: errorDetails.actionUrl,
        },
        webhook: {
          configured: webhookConfigured,
          status: webhookStatus,
        },
      },
    };

    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Stripe-Health-Status': overallStatus,
      },
    });
  } catch (error) {
    console.error('[Stripe Health] Error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Error al verificar estado de Stripe',
        services: {
          stripe_api: {
            configured: !!process.env.STRIPE_SECRET_KEY,
            status: 'unhealthy',
          },
          stripe_connect: {
            enabled: false,
            status: 'unhealthy',
            message: 'Error al verificar Stripe Connect',
          },
          webhook: {
            configured: !!process.env.STRIPE_WEBHOOK_SECRET,
            status: 'degraded',
          },
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Stripe-Health-Status': 'unhealthy',
        },
      }
    );
  }
}
