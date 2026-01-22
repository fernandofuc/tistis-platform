export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  PLAN_CONFIG,
  getPlanConfig,
  calculateBranchCostCentavos,
} from '@/src/shared/config/plans';
import {
  checkRateLimit,
  getClientIP,
  checkoutLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import { createComponentLogger } from '@/src/shared/lib';

// Create logger for checkout endpoint
const logger = createComponentLogger('stripe-checkout');

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  // Rate limiting: prevent abuse of Stripe checkout sessions (10 per hour per IP)
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, checkoutLimiter);

  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded for checkout', { clientIP });
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    const body = await req.json();
    const {
      plan,
      customerEmail,
      customerName,
      customerPhone,
      branches = 1,
      addons = [],
      vertical, // NO DEFAULT - must be explicitly provided
      proposalId,
      metadata: rawMetadata,
    } = body;
    const stripe = getStripeClient();

    // ============================================
    // CRITICAL FIX: Validate vertical is provided and valid
    // This prevents the issue where vertical defaults to 'dental'
    // when sessionStorage is cleared
    // ============================================
    // Currently active verticals (more will be added later)
    // Discovery flow sends 'otro' to /enterprise, not here
    const VALID_VERTICALS = ['dental', 'restaurant'];
    if (!vertical || !VALID_VERTICALS.includes(vertical)) {
      logger.warn('Invalid or missing vertical', { vertical });
      return NextResponse.json(
        { error: 'Vertical es requerido. Por favor vuelve a la página de precios y selecciona tu tipo de negocio.' },
        { status: 400 }
      );
    }

    // Allowlist for metadata fields to prevent arbitrary data injection
    const ALLOWED_METADATA_KEYS = ['referralCode', 'campaignId', 'source', 'utm_source', 'utm_medium', 'utm_campaign'];
    const sanitizedMetadata: Record<string, string> = {};
    if (rawMetadata && typeof rawMetadata === 'object') {
      for (const key of ALLOWED_METADATA_KEYS) {
        if (rawMetadata[key] !== undefined && typeof rawMetadata[key] === 'string') {
          // Sanitize value: limit length and remove potentially dangerous characters
          sanitizedMetadata[key] = String(rawMetadata[key]).slice(0, 500);
        }
      }
    }

    const planConfig = getPlanConfig(plan);
    if (!planConfig) {
      return NextResponse.json(
        { error: 'Plan invalido' },
        { status: 400 }
      );
    }

    // ============================================
    // CRITICAL: Validate branches against plan limits
    // This prevents users from requesting more branches than allowed
    // ============================================
    const branchCount = Math.max(1, Math.min(branches, 100)); // Clamp to 1-100
    if (branchCount > planConfig.branchLimit) {
      logger.warn('Branches exceed plan limit', { requested: branchCount, limit: planConfig.branchLimit, plan });
      return NextResponse.json(
        { error: `El plan ${planConfig.name} permite máximo ${planConfig.branchLimit} sucursales. Selecciona un plan superior o reduce las sucursales.` },
        { status: 400 }
      );
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Calculate extra branch cost using centralized function
    const extraBranches = Math.max(0, branchCount - 1);
    const branchCost = calculateBranchCostCentavos(plan, branchCount);

    // Build line items array
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // 1. Monthly subscription (plan base)
    lineItems.push({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: planConfig.displayName,
          description: `Suscripcion mensual al plan ${planConfig.name}`,
        },
        unit_amount: planConfig.monthlyPriceCentavos,
        recurring: {
          interval: 'month',
        },
      },
      quantity: 1,
    });

    // 2. Extra branches (recurring)
    if (extraBranches > 0 && branchCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: 'Sucursales Adicionales',
            description: `${extraBranches} sucursal(es) extra`,
          },
          unit_amount: branchCost,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      });
    }

    // NOTE: Activation fee removed - no longer charged

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: customerEmail,
      billing_address_collection: 'required',
      line_items: lineItems,
      subscription_data: {
        metadata: {
          plan,
          branches: branchCount.toString(),
          addons: JSON.stringify(addons),
          customerName: customerName || '',
          customerPhone: customerPhone || '',
          vertical, // Include vertical for Assembly Engine
          proposalId: proposalId || '',
          ...sanitizedMetadata,
        },
      },
      success_url: `${origin}/onboarding/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
      metadata: {
        plan,
        branches: branchCount.toString(),
        addons: JSON.stringify(addons),
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        vertical,
        proposalId: proposalId || '',
        ...sanitizedMetadata,
      },
    });

    logger.info('Checkout session created', {
      sessionId: session.id,
      plan,
      branches: branchCount,
      vertical,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Stripe checkout error', { errorMessage: err.message }, err);
    return NextResponse.json(
      { error: err.message || 'Error al crear sesion de pago' },
      { status: 500 }
    );
  }
}
