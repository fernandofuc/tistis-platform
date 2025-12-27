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

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  // Rate limiting: prevent abuse of Stripe checkout sessions (10 per hour per IP)
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, checkoutLimiter);

  if (!rateLimitResult.success) {
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
      vertical = 'dental', // Default vertical
      proposalId,
      metadata: rawMetadata,
    } = body;
    const stripe = getStripeClient();

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

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Calculate extra branch cost using centralized function
    const extraBranches = Math.max(0, branches - 1);
    const branchCost = calculateBranchCostCentavos(plan, branches);

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
          branches: branches.toString(),
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
        branches: branches.toString(),
        addons: JSON.stringify(addons),
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        vertical,
        proposalId: proposalId || '',
        ...sanitizedMetadata,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear sesion de pago' },
      { status: 500 }
    );
  }
}
