/**
 * TIS TIS - Admin API: Cleanup Duplicate Payment Methods
 *
 * This endpoint cleans up duplicate payment methods from Stripe customers.
 * It can be used to fix customers who have accumulated multiple cards.
 *
 * Usage:
 * - POST /api/admin/cleanup-payment-methods
 * - Headers: x-admin-key: <ADMIN_API_KEY>
 * - Body: { email?: string } (optional - if not provided, cleans all customers)
 *
 * IMPORTANT: This endpoint should only be used by admins.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Verify admin API key (timing-safe)
function verifyAdminKey(request: NextRequest): boolean {
  const adminKey = request.headers.get('x-admin-key');
  const expectedKey = process.env.ADMIN_API_KEY;

  // In production, ADMIN_API_KEY is required
  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Admin API] ADMIN_API_KEY not configured in production');
      return false;
    }
    // Allow in development without key
    return true;
  }

  if (!adminKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.from(adminKey);
    const expectedBuffer = Buffer.from(expectedKey);
    if (keyBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CleanupResult {
  customerId: string;
  email: string | null;
  paymentMethodsBefore: number;
  paymentMethodsAfter: number;
  removed: number;
  keptMethodId: string | null;
}

async function cleanupCustomerPaymentMethods(
  stripe: Stripe,
  customerId: string
): Promise<CleanupResult> {
  // Get customer info
  const customer = await stripe.customers.retrieve(customerId);
  const email = (customer as Stripe.Customer).email || null;

  // List all payment methods
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  const result: CleanupResult = {
    customerId,
    email,
    paymentMethodsBefore: paymentMethods.data.length,
    paymentMethodsAfter: paymentMethods.data.length,
    removed: 0,
    keptMethodId: null,
  };

  // If 0 or 1 payment methods, nothing to clean
  if (paymentMethods.data.length <= 1) {
    result.keptMethodId = paymentMethods.data[0]?.id || null;
    return result;
  }

  // Sort by created date, keep the most recent one
  const sortedMethods = [...paymentMethods.data].sort((a, b) => b.created - a.created);
  const methodToKeep = sortedMethods[0];
  const methodsToRemove = sortedMethods.slice(1);

  result.keptMethodId = methodToKeep.id;

  // Detach duplicate payment methods
  for (const method of methodsToRemove) {
    try {
      await stripe.paymentMethods.detach(method.id);
      result.removed++;
      console.log(`[CleanupPaymentMethods] Detached: ${method.id} from customer ${customerId}`);
    } catch (detachError) {
      console.error(`[CleanupPaymentMethods] Error detaching ${method.id}:`, detachError);
    }
  }

  result.paymentMethodsAfter = paymentMethods.data.length - result.removed;

  return result;
}

export async function POST(req: NextRequest) {
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    const stripe = getStripeClient();
    const results: CleanupResult[] = [];

    if (email) {
      // Clean specific customer by email
      const normalizedEmail = email.toLowerCase();
      console.log(`[CleanupPaymentMethods] Cleaning up payment methods for: ${normalizedEmail}`);

      const customers = await stripe.customers.list({
        email: normalizedEmail,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return NextResponse.json({
          error: 'Customer not found',
          email: normalizedEmail,
        }, { status: 404 });
      }

      const result = await cleanupCustomerPaymentMethods(stripe, customers.data[0].id);
      results.push(result);
    } else {
      // Clean all customers with stripe_customer_id in our database
      console.log('[CleanupPaymentMethods] Cleaning up all customers with duplicates...');

      const supabase = getSupabaseAdmin();
      const { data: clients } = await supabase
        .from('clients')
        .select('stripe_customer_id')
        .not('stripe_customer_id', 'is', null);

      if (clients && clients.length > 0) {
        for (const client of clients) {
          if (client.stripe_customer_id) {
            try {
              const result = await cleanupCustomerPaymentMethods(stripe, client.stripe_customer_id);
              // Only add to results if there was something to clean
              if (result.paymentMethodsBefore > 1) {
                results.push(result);
              }
            } catch (err) {
              console.error(`[CleanupPaymentMethods] Error processing customer ${client.stripe_customer_id}:`, err);
            }
          }
        }
      }
    }

    const totalRemoved = results.reduce((sum, r) => sum + r.removed, 0);

    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Removed ${totalRemoved} duplicate payment methods from ${results.length} customers.`,
      customersProcessed: results.length,
      totalRemoved,
      results,
    });
  } catch (error) {
    console.error('[CleanupPaymentMethods] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check payment methods status without cleaning
export async function GET(req: NextRequest) {
  // Verify admin authorization
  if (!verifyAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const normalizedEmail = email.toLowerCase();

    const customers = await stripe.customers.list({
      email: normalizedEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        error: 'Customer not found',
        email: normalizedEmail,
      }, { status: 404 });
    }

    const customer = customers.data[0];
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    return NextResponse.json({
      customerId: customer.id,
      email: customer.email,
      paymentMethodsCount: paymentMethods.data.length,
      hasDuplicates: paymentMethods.data.length > 1,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        created: new Date(pm.created * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[CleanupPaymentMethods] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
