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
  'https://tistis-platform-5fc5.vercel.app',
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

    const { client: supabase, tenantId, user } = authContext;

    console.log('[Customer Portal] Looking for tenant:', tenantId, 'user:', user.id);

    // 2. Get tenant with linked client info
    let tenant: { id: string; name: string; client_id: string | null } | null = null;

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, client_id')
      .eq('id', tenantId)
      .single();

    if (tenantData) {
      tenant = tenantData;
      console.log('[Customer Portal] Found tenant directly:', tenant.id);
    }

    // Fallback: If tenant not found by tenantId, try to find via staff -> tenant
    if (!tenant) {
      console.log('[Customer Portal] Tenant not found by ID, trying staff lookup...');

      const { data: staffData } = await supabase
        .from('staff')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (staffData?.tenant_id) {
        const { data: tenantFromStaff } = await supabase
          .from('tenants')
          .select('id, name, client_id')
          .eq('id', staffData.tenant_id)
          .single();

        if (tenantFromStaff) {
          tenant = tenantFromStaff;
          console.log('[Customer Portal] Found tenant via staff:', tenant.id);
        }
      }
    }

    // Fallback 2: Try via clients table where user_id matches
    if (!tenant && user.id) {
      console.log('[Customer Portal] Trying client lookup by user_id...');

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, tenant_id, stripe_customer_id, business_name')
        .eq('user_id', user.id)
        .single();

      if (clientData?.tenant_id) {
        const { data: tenantFromClient } = await supabase
          .from('tenants')
          .select('id, name, client_id')
          .eq('id', clientData.tenant_id)
          .single();

        if (tenantFromClient) {
          tenant = tenantFromClient;
          console.log('[Customer Portal] Found tenant via client.tenant_id:', tenant.id);
        }
      }
    }

    if (!tenant) {
      console.error('[Customer Portal] Tenant not found for user:', user.id, 'tenantId:', tenantId, 'error:', tenantError);
      return NextResponse.json(
        { error: 'No se encontró información del tenant. Por favor contacta soporte.' },
        { status: 404 }
      );
    }

    // 3. Find stripe_customer_id - try multiple sources
    let stripeCustomerId: string | null = null;

    // Strategy 1: Check via tenant.client_id -> clients.stripe_customer_id
    if (tenant.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('id', tenant.client_id)
        .single();

      if (clientData?.stripe_customer_id) {
        stripeCustomerId = clientData.stripe_customer_id;
        console.log('[Customer Portal] Found stripe_customer_id via tenant.client_id');
      }
    }

    // Strategy 2: Check clients table by tenant_id (reverse lookup)
    if (!stripeCustomerId) {
      const { data: clientByTenant } = await supabase
        .from('clients')
        .select('id, stripe_customer_id')
        .eq('tenant_id', tenant.id)
        .single();

      if (clientByTenant?.stripe_customer_id) {
        stripeCustomerId = clientByTenant.stripe_customer_id;
        console.log('[Customer Portal] Found stripe_customer_id via clients.tenant_id');
      }
    }

    // Strategy 3: Check subscriptions table via client
    if (!stripeCustomerId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .single();

      if (client) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('stripe_customer_id, status')
          .eq('client_id', client.id)
          .in('status', ['active', 'past_due', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (subscription?.stripe_customer_id) {
          stripeCustomerId = subscription.stripe_customer_id;
          console.log('[Customer Portal] Found stripe_customer_id in subscriptions via client');
        }
      }
    }

    // Strategy 4: Check clients table by user_id directly
    if (!stripeCustomerId && user.id) {
      const { data: clientByUser } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();

      if (clientByUser?.stripe_customer_id) {
        stripeCustomerId = clientByUser.stripe_customer_id;
        console.log('[Customer Portal] Found stripe_customer_id via clients.user_id');
      }
    }

    // Strategy 5: Check subscriptions table directly by tenant_id
    if (!stripeCustomerId) {
      const { data: subByTenant } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id, status')
        .eq('tenant_id', tenant.id)
        .in('status', ['active', 'past_due', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (subByTenant?.stripe_customer_id) {
        stripeCustomerId = subByTenant.stripe_customer_id;
        console.log('[Customer Portal] Found stripe_customer_id in subscriptions by tenant_id');
      }
    }

    if (!stripeCustomerId) {
      console.error('[Customer Portal] No stripe_customer_id found for tenant:', tenant.id, 'user:', user.id);
      return NextResponse.json(
        { error: 'No se encontró información de facturación. Por favor contacta soporte.' },
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
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    console.log('[Customer Portal] Session created for tenant:', tenant.id, 'stripeCustomerId:', stripeCustomerId);

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
