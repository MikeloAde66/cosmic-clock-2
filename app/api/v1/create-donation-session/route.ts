import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response('Donations are not configured yet.', { status: 500 });
  }

  const { amount_in_cents, is_recurring } = (await request.json()) as {
    amount_in_cents?: number;
    is_recurring?: boolean;
  };

  if (!amount_in_cents || amount_in_cents < 50) {
    return new Response('Invalid donation amount.', { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = request.headers.get('origin') || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: is_recurring ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'Donation to AI ONE — Support the Mission' },
            unit_amount: amount_in_cents,
            ...(is_recurring ? { recurring: { interval: 'month' as const } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?donation=success`,
      cancel_url: `${origin}/?donation=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout session error:', err);
    const message = err instanceof Stripe.errors.StripeError ? err.message : 'Checkout session failed.';
    return new Response(message, { status: 500 });
  }
}
