import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Plan prices in MXN centavos
const PLAN_PRICES: Record<string, { monthly: number; name: string }> = {
  starter: { monthly: 599000, name: 'TIS TIS Starter' },
  essentials: { monthly: 899000, name: 'TIS TIS Essentials' },
  growth: { monthly: 1499000, name: 'TIS TIS Growth' },
  scale: { monthly: 2499000, name: 'TIS TIS Scale' },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, customerEmail, customerName, metadata } = body;

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: 'Plan inválido' },
        { status: 400 }
      );
    }

    const planConfig = PLAN_PRICES[plan];
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_URL;

    // Create Stripe Checkout Session with setup fee included in first invoice
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: customerEmail,
      billing_address_collection: 'required',
      line_items: [
        // Monthly subscription
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: planConfig.name,
              description: `Suscripción mensual al plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
            },
            unit_amount: planConfig.monthly,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          plan,
          customerName: customerName || '',
          ...metadata,
        },
      },
      success_url: `${origin}/dashboard?welcome=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=true`,
      metadata: {
        plan,
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
      { error: error.message || 'Error al crear sesión de pago' },
      { status: 500 }
    );
  }
}
