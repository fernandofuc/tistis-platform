import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Cliente server-side (para API routes)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Cliente browser (para checkout)
let stripePromise: Promise<any> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);
  }
  return stripePromise;
};
