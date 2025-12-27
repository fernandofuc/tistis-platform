// =====================================================
// TIS TIS PLATFORM - Stripe Customer Portal API
// Creates a Stripe Billing Portal session for customers
// to view invoices, update payment methods, etc.
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { checkRateLimit, getClientIP, strictLimiter, rateLimitExceeded } from '@/src/shared/lib/rate-limit';

// Allowed origins for return URL (prevent open redirect)
const ALLOWED_ORIGINS = [
  'https://app.tistis.com',
  'https://tistis.com',
  process.env.NEXT_PUBLIC_URL,
].filter(Boolean) as string[];

// In development, also allow localhost
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003'
  );
}

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(request: NextRequest) {
  try {
    // 0. Rate limiting - prevent abuse of portal session creation
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, strictLimiter);

    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    // 1. Authenticate user
    const authContext = await getAuthenticatedContext(request);

    if (isAuthError(authContext)) {
      return createAuthErrorResponse(authContext);
    }

    const { client: supabase, tenantId } = authContext;

    // 2. Get tenant to find stripe_customer_id
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[Customer Portal] Tenant not found:', tenantError);
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // 3. Find subscription with stripe_customer_id for this tenant
    // First get client_id from tenant
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    if (!client) {
      console.error('[Customer Portal] Client not found for tenant:', tenantId);
      return NextResponse.json(
        { error: 'No client associated with this tenant' },
        { status: 404 }
      );
    }

    // Get subscription with stripe_customer_id
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, status')
      .eq('client_id', client.id)
      .in('status', ['active', 'past_due', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      console.error('[Customer Portal] No active subscription found:', subError);
      return NextResponse.json(
        { error: 'No active subscription found. Please contact support.' },
        { status: 404 }
      );
    }

    // 4. Create Stripe Customer Portal session
    const stripe = getStripeClient();

    // Validate origin to prevent open redirect attacks
    const requestOrigin = request.headers.get('origin');
    let returnOrigin = process.env.NEXT_PUBLIC_URL || 'https://app.tistis.com';

    if (requestOrigin && ALLOWED_ORIGINS.some(allowed => requestOrigin.startsWith(allowed))) {
      returnOrigin = requestOrigin;
    }

    const returnUrl = `${returnOrigin}/dashboard/settings?tab=billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log('[Customer Portal] Session created for tenant:', tenantId);

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: unknown) {
    console.error('[Customer Portal] Error:', error);

    // Handle specific Stripe errors without exposing internal details
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        { error: 'Error de configuración de facturación. Por favor contacta soporte.' },
        { status: 400 }
      );
    }

    // Generic error - don't expose internal error messages
    return NextResponse.json(
      { error: 'Error al crear la sesión del portal. Por favor intenta de nuevo.' },
      { status: 500 }
    );
  }
}
