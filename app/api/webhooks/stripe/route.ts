import Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { findProduct } from '@/lib/products';
import { createPrintfulOrder } from '@/lib/fulfillment/printful';
import { createGelatoOrder } from '@/lib/fulfillment/gelato';
import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import type { VaultDrawer } from '@/lib/vaultRegistry';

export const runtime = 'nodejs';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

async function updateOrder(admin: SupabaseAdmin, sessionId: string, fields: Record<string, unknown>) {
  const { error } = await admin
    .from('orders')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId);
  if (error) console.error('Failed to update order row:', error);
}

// Parses "vault:<drawer>:<sku>:<variantId>" ids (see resolveCheckoutItem in
// app/actions/purchase.ts) — returns null for legacy pack-level listings
// (no trailing :variantId) and for non-vault productIds.
function parseVaultVariantProductId(productId: string): { drawer: string; sku: string; variantId: string } | null {
  if (!productId.startsWith('vault:')) return null;
  const rest = productId.slice('vault:'.length);
  const sep = rest.indexOf(':');
  if (sep === -1) return null;
  const drawer = rest.slice(0, sep);
  const skuAndVariant = rest.slice(sep + 1);
  const lastSep = skuAndVariant.lastIndexOf(':');
  if (lastSep === -1) return null;
  return { drawer, sku: skuAndVariant.slice(0, lastSep), variantId: skuAndVariant.slice(lastSep + 1) };
}

// Decrements a purchased variant's inventoryCount, marking it unavailable
// once it hits zero — a 1-of-1 physical original (or any other finite-stock
// variant) shouldn't still show as buyable on the storefront after it's
// actually sold.
async function decrementVaultVariantInventoryIfApplicable(productId: string) {
  const parsed = parseVaultVariantProductId(productId);
  if (!parsed || !process.env.MONGODB_URI) return;
  const { drawer, sku, variantId } = parsed;

  try {
    await dbConnect();
    const doc = await VaultProduct.findOne({ sku, drawer: drawer as VaultDrawer });
    const variant = doc?.productVariants?.find((v) => v.id === variantId);
    if (!doc || !variant || variant.inventoryCount === undefined) return;
    const nextCount = Math.max(0, variant.inventoryCount - 1);
    variant.inventoryCount = nextCount;
    if (nextCount === 0) variant.isAvailable = false;
    await doc.save();
  } catch (err) {
    console.error('Failed to decrement Vault variant inventory:', err);
  }
}

// One-time product purchases (mode: 'payment') -- routes physical items to
// Printful/Gelato based on product_type, skips fulfillment entirely for
// digital items. Never throws: a failed fulfillment call marks the order
// 'failed' rather than crashing the webhook (Stripe would just retry
// delivery of the same event, which won't fix a downstream API problem).
async function handleProductOrderCompleted(session: Stripe.Checkout.Session, admin: SupabaseAdmin) {
  const productId = session.metadata?.productId;
  const productType = session.metadata?.product_type;
  if (!productId || !productType) return;

  const shipping = session.collected_information?.shipping_details;
  const customerEmail = session.customer_details?.email ?? undefined;
  // product_id already carries the variant as part of its own composite
  // form (vault:<drawer>:<sku>:<variantId>), but a dedicated column is far
  // more useful for querying/reporting than re-parsing that string every
  // time — e.g. "every order for this variant across packs."
  const variantId = parseVaultVariantProductId(productId)?.variantId ?? null;

  const { error: insertError } = await admin.from('orders').insert({
    stripe_checkout_session_id: session.id,
    product_id: productId,
    variant_id: variantId,
    product_type: productType,
    amount: session.amount_total ?? 0,
    shipping_address: shipping ? { name: shipping.name, ...shipping.address } : null,
    fulfillment_status: 'pending',
  });
  if (insertError) {
    console.error('Failed to record order (continuing to attempt fulfillment regardless):', insertError);
  }

  if (productType === 'digital') {
    // No physical shipment — mark delivered immediately. (Actually gating
    // download access behind purchase status is a separate, not-yet-built
    // piece; this only reflects fulfillment state.)
    await updateOrder(admin, session.id, { fulfillment_status: 'delivered' });
    await decrementVaultVariantInventoryIfApplicable(productId);
    return;
  }

  if (productType === 'vault_shipment') {
    // A Vault-sourced physical original already exists as a real object —
    // there's no Printful/Gelato print-on-demand order to place. The seller
    // has to pack and ship it themselves; this just records that a real
    // sale happened and is waiting on that, with the shipping address
    // already captured in the insert above.
    await updateOrder(admin, session.id, { fulfillment_status: 'awaiting_manual_fulfillment' });
    await decrementVaultVariantInventoryIfApplicable(productId);
    return;
  }

  const product = findProduct(productId);
  if (!product) {
    await updateOrder(admin, session.id, { fulfillment_status: 'unmapped' });
    return;
  }

  if (productType === 'apparel') {
    if (!product.printfulVariantId || !shipping) {
      // No real Printful catalog variant mapped to this demo product (or no
      // shipping address collected) -- report honestly rather than guessing.
      await updateOrder(admin, session.id, { fulfillment_provider: 'printful', fulfillment_status: 'unmapped' });
      return;
    }
    try {
      const result = await createPrintfulOrder(
        {
          name: shipping.name,
          address1: shipping.address.line1 ?? '',
          address2: shipping.address.line2 ?? undefined,
          city: shipping.address.city ?? '',
          state_code: shipping.address.state ?? undefined,
          country_code: shipping.address.country ?? '',
          zip: shipping.address.postal_code ?? '',
          email: customerEmail,
        },
        [
          {
            variant_id: product.printfulVariantId,
            quantity: 1,
            retail_price: (product.amount / 100).toFixed(2),
            // Real print artwork URL goes here once a real catalog exists.
            files: [],
          },
        ]
      );
      await updateOrder(admin, session.id, {
        fulfillment_provider: 'printful',
        fulfillment_order_id: String(result.id),
        fulfillment_status: 'submitted',
      });
    } catch (err) {
      console.error('Printful order creation failed:', err);
      await updateOrder(admin, session.id, { fulfillment_provider: 'printful', fulfillment_status: 'failed' });
    }
    return;
  }

  if (productType === 'print_collateral') {
    if (!product.gelatoProductUid || !shipping) {
      await updateOrder(admin, session.id, { fulfillment_provider: 'gelato', fulfillment_status: 'unmapped' });
      return;
    }
    try {
      const [firstName, ...rest] = shipping.name.split(' ');
      const result = await createGelatoOrder(
        session.id,
        [
          {
            itemReferenceId: product.id,
            productUid: product.gelatoProductUid,
            // Real print artwork URL goes here once a real catalog exists.
            files: [],
            quantity: 1,
          },
        ],
        {
          firstName: firstName || shipping.name,
          lastName: rest.join(' ') || '-',
          addressLine1: shipping.address.line1 ?? '',
          addressLine2: shipping.address.line2 ?? undefined,
          city: shipping.address.city ?? '',
          state: shipping.address.state ?? undefined,
          postCode: shipping.address.postal_code ?? '',
          country: shipping.address.country ?? '',
          email: customerEmail,
        }
      );
      await updateOrder(admin, session.id, {
        fulfillment_provider: 'gelato',
        fulfillment_order_id: result.id,
        fulfillment_status: 'submitted',
      });
    } catch (err) {
      console.error('Gelato order creation failed:', err);
      await updateOrder(admin, session.id, { fulfillment_provider: 'gelato', fulfillment_status: 'failed' });
    }
  }
}

// Completes the loop the checkout Server Actions start: they each insert a
// pending row (in `subscriptions` for Pricing, `orders` for Products)
// keyed by the Checkout Session id before redirecting to Stripe; this
// endpoint fills in what actually happened once Stripe confirms it, and for
// product orders, triggers physical fulfillment. Requires a webhook
// endpoint configured in the Stripe dashboard (or `stripe listen --forward-to
// .../api/webhooks/stripe` for local dev) pointed here, with its signing
// secret set as STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe webhook is not configured.', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature header.', { status: 400 });
  }

  const body = await request.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return new Response('Invalid signature.', { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription') {
          await admin
            .from('subscriptions')
            .update({
              stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_checkout_session_id', session.id);
        } else if (session.mode === 'payment') {
          await handleProductOrderCompleted(session, admin);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await admin
          .from('subscriptions')
          .update({ status: subscription.status, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }

      default:
        // Unhandled event types are expected — Stripe sends far more than
        // we care about tracking; only ack them.
        break;
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling error:', err);
    const message = err instanceof Error ? err.message : 'Webhook handling failed.';
    return new Response(message, { status: 500 });
  }
}
