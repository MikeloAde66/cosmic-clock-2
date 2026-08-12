'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { findProduct } from '@/lib/products';

// One-time purchase, not a subscription — mode: 'payment' with inline
// price_data rather than a pre-created Stripe Price. These are demo
// products with no real inventory yet, so there's nothing worth
// provisioning as a persistent Stripe object (unlike the Pricing tiers,
// which are real Products/Prices). Swap to a stored priceId + mode:
// 'payment' with `price: priceId` if/when this becomes a real catalog.
export async function createProductCheckout(formData: FormData) {
  const productId = formData.get('productId');
  if (typeof productId !== 'string') {
    throw new Error('Missing productId.');
  }
  const product = findProduct(productId);
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
            name: product.name,
            description: product.description,
            metadata: { productId: product.id, demo: 'true' },
          },
          unit_amount: product.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/?purchase=success`,
    cancel_url: `${origin}/?purchase=cancelled`,
    metadata: { productId: product.id },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }
  redirect(session.url);
}
