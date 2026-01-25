// =====================================================
// TIS TIS PLATFORM - Universal Health Check Endpoint
// Production-ready health check for load balancers,
// monitoring systems, and Kubernetes probes.
// FASE 9 - Deployment (Bucle Agéntico v2)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ======================
// CONSTANTS
// ======================
const APP_VERSION = '4.6.0'; // Hardcoded - npm_package_version not available in Vercel runtime
const DATABASE_TIMEOUT_MS = 5000;
const LATENCY_DEGRADED_THRESHOLD_MS = 1000;

// ======================
// TYPES
// ======================
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
  last_check?: string;
}

interface HealthResponsePublic {
  status: HealthStatus;
  timestamp: string;
  version: string;
}

interface HealthResponseDetailed extends HealthResponsePublic {
  environment: string;
  uptime_seconds: number;
  services: {
    database: ServiceHealth;
    auth: ServiceHealth;
    ai_providers: ServiceHealth;
    voice_agent: ServiceHealth;
    payments: ServiceHealth;
    email: ServiceHealth;
  };
  checks: {
    env_vars: boolean;
    cron_secret: boolean;
    stripe_configured: boolean;
    supabase_configured: boolean;
    ai_configured: boolean;
  };
  metrics?: {
    memory_usage_mb: number;
    heap_used_mb: number;
    external_mb: number;
  };
}

// ======================
// STARTUP TIME
// ======================
const startupTime = Date.now();

// ======================
// SUPABASE CLIENT SINGLETON
// ======================
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

// ======================
// TIMEOUT WRAPPER
// ======================
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch {
    clearTimeout(timeoutId!);
    return fallback;
  }
}

// ======================
// HEALTH CHECK FUNCTIONS
// ======================

async function checkDatabase(): Promise<ServiceHealth> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      status: 'unhealthy',
      message: 'Supabase credentials not configured',
    };
  }

  const start = Date.now();

  const check = async (): Promise<ServiceHealth> => {
    try {
      const { error } = await client
        .from('tenants')
        .select('id')
        .limit(1);

      const latency = Date.now() - start;

      if (error) {
        return {
          status: 'unhealthy',
          latency_ms: latency,
          message: error.message,
        };
      }

      return {
        status: latency > LATENCY_DEGRADED_THRESHOLD_MS ? 'degraded' : 'healthy',
        latency_ms: latency,
        last_check: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return withTimeout(check(), DATABASE_TIMEOUT_MS, {
    status: 'unhealthy',
    latency_ms: DATABASE_TIMEOUT_MS,
    message: 'Database check timed out',
  });
}

function checkAuth(): ServiceHealth {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      status: 'unhealthy',
      message: 'Auth credentials not configured',
    };
  }

  return {
    status: 'healthy',
    last_check: new Date().toISOString(),
  };
}

function checkAIProviders(): ServiceHealth {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // At least one AI provider is required
  if (!anthropicKey && !openaiKey) {
    return {
      status: 'unhealthy',
      message: 'No AI providers configured',
    };
  }

  const providers: string[] = [];
  if (anthropicKey) providers.push('Anthropic');
  if (openaiKey) providers.push('OpenAI');

  return {
    status: 'healthy',
    message: `Configured: ${providers.join(', ')}`,
    last_check: new Date().toISOString(),
  };
}

function checkVoiceAgent(): ServiceHealth {
  const vapiKey = process.env.VAPI_API_KEY;
  const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;

  if (!vapiKey) {
    return {
      status: 'degraded', // Voice is optional feature
      message: 'VAPI not configured',
    };
  }

  if (!vapiSecret) {
    return {
      status: 'degraded',
      message: 'VAPI webhook secret not configured',
    };
  }

  return {
    status: 'healthy',
    last_check: new Date().toISOString(),
  };
}

function checkPayments(): ServiceHealth {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const stripePubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!stripeSecret) {
    return {
      status: 'unhealthy',
      message: 'Stripe not configured',
    };
  }

  // Warn if using test keys in production
  const isProduction = process.env.NODE_ENV === 'production';
  const isTestKey = stripeSecret.startsWith('sk_test_');

  if (isProduction && isTestKey) {
    return {
      status: 'degraded',
      message: 'Using Stripe test keys in production',
    };
  }

  if (!stripeWebhook || !stripePubKey) {
    return {
      status: 'degraded',
      message: 'Stripe partially configured',
    };
  }

  return {
    status: 'healthy',
    last_check: new Date().toISOString(),
  };
}

function checkEmail(): ServiceHealth {
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    return {
      status: 'degraded',
      message: 'Email service not configured',
    };
  }

  return {
    status: 'healthy',
    last_check: new Date().toISOString(),
  };
}

function checkEnvironmentVars(): boolean {
  const criticalVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  return criticalVars.every((varName) => !!process.env[varName]);
}

function getMemoryMetrics() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      memory_usage_mb: Math.round(usage.rss / 1024 / 1024),
      heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
      external_mb: Math.round(usage.external / 1024 / 1024),
    };
  }
  return undefined;
}

function determineOverallStatus(
  services: HealthResponseDetailed['services']
): HealthStatus {
  const { database } = services;
  const serviceStatuses = Object.values(services).map((s) => s.status);

  // Database unhealthy = overall unhealthy
  if (database.status === 'unhealthy') {
    return 'unhealthy';
  }

  // Any unhealthy service = degraded (except database which is critical)
  if (serviceStatuses.includes('unhealthy')) {
    return 'degraded';
  }

  // Any degraded service = degraded
  if (serviceStatuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

// ======================
// AUTH CHECK FOR DETAILED INFO
// ======================
function isAuthorizedForDetails(request: NextRequest): boolean {
  // In development, always allow detailed info
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // Check for internal header (set by load balancer or internal services)
  const internalToken = request.headers.get('x-health-token');
  const expectedToken = process.env.HEALTH_CHECK_TOKEN;

  if (expectedToken && internalToken === expectedToken) {
    return true;
  }

  // Check if request is from internal network (localhost/private IPs)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || '';

  // Allow localhost and private IP ranges (RFC 1918)
  if (ip === '127.0.0.1' || ip === '::1') {
    return true;
  }

  // 10.0.0.0/8
  if (ip.startsWith('10.')) {
    return true;
  }

  // 192.168.0.0/16
  if (ip.startsWith('192.168.')) {
    return true;
  }

  // 172.16.0.0/12 (172.16.x.x to 172.31.x.x)
  if (ip.startsWith('172.')) {
    const secondOctet = parseInt(ip.split('.')[1] || '0', 10);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

// ======================
// MAIN HANDLER
// ======================
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const includeMetrics = searchParams.get('metrics') === 'true';

  const baseHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  // Fast liveness check - just verify the server is responding
  if (type === 'liveness') {
    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      {
        status: 200,
        headers: {
          ...baseHeaders,
          'X-Health-Status': 'ok',
        },
      }
    );
  }

  // Check all services
  const [database, auth, aiProviders, voiceAgent, payments, email] =
    await Promise.all([
      checkDatabase(),
      Promise.resolve(checkAuth()),
      Promise.resolve(checkAIProviders()),
      Promise.resolve(checkVoiceAgent()),
      Promise.resolve(checkPayments()),
      Promise.resolve(checkEmail()),
    ]);

  const services = {
    database,
    auth,
    ai_providers: aiProviders,
    voice_agent: voiceAgent,
    payments,
    email,
  };

  const overallStatus = determineOverallStatus(services);

  // For public access, return minimal info
  if (!isAuthorizedForDetails(request) && type !== 'readiness') {
    const publicResponse: HealthResponsePublic = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };

    return NextResponse.json(publicResponse, {
      status: overallStatus === 'unhealthy' ? 503 : 200,
      headers: {
        ...baseHeaders,
        'X-Health-Status': overallStatus,
      },
    });
  }

  // Build detailed response
  const response: HealthResponseDetailed = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    environment: process.env.NODE_ENV || 'development',
    uptime_seconds: Math.floor((Date.now() - startupTime) / 1000),
    services,
    checks: {
      env_vars: checkEnvironmentVars(),
      cron_secret: !!process.env.CRON_SECRET,
      stripe_configured: !!process.env.STRIPE_SECRET_KEY,
      supabase_configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      ai_configured: !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY,
    },
  };

  // Add memory metrics if requested
  if (includeMetrics || type === 'detailed') {
    response.metrics = getMemoryMetrics();
  }

  // Readiness check - return 503 if not ready
  if (type === 'readiness') {
    const isReady = overallStatus !== 'unhealthy' && database.status !== 'unhealthy';

    return NextResponse.json(response, {
      status: isReady ? 200 : 503,
      headers: {
        ...baseHeaders,
        'X-Health-Status': overallStatus,
        'X-Database-Status': database.status,
      },
    });
  }

  // Full health check
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      ...baseHeaders,
      'X-Health-Status': overallStatus,
      'X-Uptime-Seconds': String(response.uptime_seconds),
    },
  });
}
