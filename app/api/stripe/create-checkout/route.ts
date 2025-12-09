export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// Create Stripe client lazily
function getStripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Plan configuration - prices in MXN centavos
const PLAN_CONFIG: Record<string, {
  monthly: number;
  name: string;
  activation: number;
  branchExtra: number;
  branchExtraProgressive?: { qty: number; price: number }[];
}> = {
  starter: {
    monthly: 349000,
    name: 'TIS TIS Starter',
    activation: 559000,
    branchExtra: 159000,
  },
  essentials: {
    monthly: 749000,
    name: 'TIS TIS Essentials',
    activation: 899000,
    branchExtra: 199000,
    branchExtraProgressive: [
      { qty: 2, price: 199000 },
      { qty: 3, price: 179000 },
      { qty: 4, price: 159000 },
      { qty: 5, price: 149000 },
    ],
  },
  growth: {
    monthly: 1249000,
    name: 'TIS TIS Growth',
    activation: 1249000,
    branchExtra: 289000,
    branchExtraProgressive: [
      { qty: 2, price: 289000 },
      { qty: 3, price: 249000 },
      { qty: 4, price: 199000 },
      { qty: 5, price: 159000 },
    ],
  },
  scale: {
    monthly: 1999000,
    name: 'TIS TIS Scale',
    activation: 2499000,
    branchExtra: 359000,
    branchExtraProgressive: [
      { qty: 2, price: 359000 },
      { qty: 3, price: 289000 },
      { qty: 4, price: 249000 },
      { qty: 5, price: 199000 },
    ],
  },
};

// Calculate branch cost with progressive pricing
function calculateBranchCost(plan: typeof PLAN_CONFIG[string], branches: number): number {
  if (branches <= 1) return 0;

  let totalCost = 0;
  if (plan.branchExtraProgressive) {
    for (let i = 2; i <= branches; i++) {
      const tierInfo = plan.branchExtraProgressive.find(t => t.qty === i);
      if (tierInfo) {
        totalCost += tierInfo.price;
      } else {
        // Use qty=5 price for branches 5+
        const tier5 = plan.branchExtraProgressive.find(t => t.qty === 5);
        totalCost += tier5 ? tier5.price : plan.branchExtra;
      }
    }
  } else {
    // Flat pricing (Starter plan)
    totalCost = (branches - 1) * plan.branchExtra;
  }
  return totalCost;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      plan,
      customerEmail,
      customerName,
      branches = 1,
      addons = [],
      metadata,
    } = body;
    const stripe = getStripeClient();

    if (!plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json(
        { error: 'Plan invalido' },
        { status: 400 }
      );
    }

    const planConfig = PLAN_CONFIG[plan];
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Calculate extra branch cost
    const extraBranches = Math.max(0, branches - 1);
    const branchCost = calculateBranchCost(planConfig, branches);

    // Build line items array
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // 1. Monthly subscription (plan base)
    lineItems.push({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: planConfig.name,
          description: `Suscripcion mensual al plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        },
        unit_amount: planConfig.monthly,
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

    // 3. Activation fee (one-time)
    lineItems.push({
      price_data: {
        currency: 'mxn',
        product_data: {
          name: 'Activacion TIS TIS',
          description: 'Pago unico de configuracion inicial - Cubre 50% de los primeros 2 meses',
        },
        unit_amount: planConfig.activation,
      },
      quantity: 1,
    });

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
          ...metadata,
        },
      },
      success_url: `${origin}/dashboard?welcome=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
      metadata: {
        plan,
        branches: branches.toString(),
        addons: JSON.stringify(addons),
        customerName: customerName || '',
        ...metadata,
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
