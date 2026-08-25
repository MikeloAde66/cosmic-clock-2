'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { HARDWARE_PRODUCTS } from '@/lib/hardwareProducts';

// Real one-time Stripe charge for a hardware pre-order — mode: 'payment'
// with inline price_data (same pattern as createCartCheckout in
// purchase.ts) rather than a persisted Stripe Price, since none of these
// three products has one provisioned. Unlike createStandaloneCheckoutSession
// in checkout.ts, there's no order-fulfillment webhook wired for these yet
// (no OS image/STL files exist to hand over) — this only takes the real
// payment; the thank-you page says so honestly rather than claiming an
// instant unlock.
export async function createHardwareCheckoutSession(formData: FormData) {
  const productId = formData.get('productId');
  const userEmail = formData.get('userEmail');

  if (typeof productId !== 'string') {
    throw new Error('Missing productId.');
  }
  const product = HARDWARE_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    throw new Error('Unknown product.');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured.');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const headersList = await headers();
  const origin = headersList.get('origin') || `http://${headersList.get('host') ?? 'localhost:3000'}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.brandedTitle,
            description: product.heroTagline,
            metadata: { productId: product.id },
          },
          unit_amount: product.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/products/${product.id}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.id}`,
    customer_email: typeof userEmail === 'string' && userEmail ? userEmail : undefined,
    metadata: { productId: product.id, kind: 'hardware_preorder' },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }
  redirect(session.url);
}
