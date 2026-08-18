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

// Scoped by (session_id, product_id), not just session_id — a cart checkout
// can produce several order rows per session (one per line item), each with
// its own independent fulfillment path, so updating by session alone would
// overwrite every line in the cart with one line's status.
async function updateOrder(admin: SupabaseAdmin, sessionId: string, productId: string, fields: Record<string, unknown>) {
  const { error } = await admin
    .from('orders')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId)
    .eq('product_id', productId);
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
async function decrementVaultVariantInventoryIfApplicable(productId: string, quantity: number) {
  const parsed = parseVaultVariantProductId(productId);
  if (!parsed || !process.env.MONGODB_URI) return;
  const { drawer, sku, variantId } = parsed;

  try {
    await dbConnect();
    const doc = await VaultProduct.findOne({ sku, drawer: drawer as VaultDrawer });
    const variant = doc?.productVariants?.find((v) => v.id === variantId);
    if (!doc || !variant || variant.inventoryCount === undefined) return;
    const nextCount = Math.max(0, variant.inventoryCount - quantity);
    variant.inventoryCount = nextCount;
    if (nextCount === 0) variant.isAvailable = false;
    await doc.save();
  } catch (err) {
    console.error('Failed to decrement Vault variant inventory:', err);
  }
}

// Permanent, product-specific feature unlocks live in app_metadata (same
// mechanism/location as the admin role flag in lib/adminAuth.ts) — settable
// only via this service-role client, never by the user themselves. Reads
// the account's current app_metadata first and merges into it rather than
// overwriting, so this can never accidentally clear an existing admin role
// or a different product's unlock flag. Never throws: a failed grant here
// shouldn't fail the whole webhook or roll back the order/fulfillment work
// already done above it — it just means the purchase is recorded and
// delivered as a digital product but the in-app tab needs unlocking by
// other means (e.g. a manual grant) until this is retried or fixed.
async function grantEntitlementIfApplicable(admin: SupabaseAdmin, productId: string, userId: string | undefined) {
  if (productId !== 'star-tracker' || !userId) return;
  try {
    const { data, error: fetchError } = await admin.auth.admin.getUserById(userId);
    if (fetchError || !data.user) throw fetchError ?? new Error('User not found.');
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { ...data.user.app_metadata, starTrackerUnlocked: true },
    });
    if (updateError) throw updateError;
  } catch (err) {
    console.error(`Failed to grant Star Tracker entitlement for user ${userId}:`, err);
  }
}

// One-time product purchases (mode: 'payment') -- routes physical items to
// Printful/Gelato based on product_type, skips fulfillment entirely for
// digital items. Never throws: a failed fulfillment call marks that line's
// order row 'failed' rather than crashing the webhook (Stripe would just
// retry delivery of the same event, which won't fix a downstream API
// problem). A cart checkout can bundle several products with different
// fulfillment paths into one Stripe session, so this reads each line item
// back from Stripe (rather than a single session-level metadata.productId)
// and fulfills every line independently, one order row each.
async function handleProductOrderCompleted(session: Stripe.Checkout.Session, admin: SupabaseAdmin, stripe: Stripe) {
  const shipping = session.collected_information?.shipping_details;
  const customerEmail = session.customer_details?.email ?? undefined;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ['data.price.product'],
    limit: 100,
  });

  for (const line of lineItems.data) {
    const stripeProduct = line.price?.product;
    if (!stripeProduct || typeof stripeProduct === 'string' || stripeProduct.deleted) continue;
    const productId = stripeProduct.metadata?.productId;
    const productType = stripeProduct.metadata?.product_type;
    if (!productId || !productType) continue; // not a line item this webhook created — skip rather than guess

    const quantity = line.quantity ?? 1;
    const amount = line.amount_total ?? 0;
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
      amount,
      shipping_address: shipping ? { name: shipping.name, ...shipping.address } : null,
      fulfillment_status: 'pending',
    });
    if (insertError) {
      // Unique violation on (session_id, product_id) means Stripe redelivered
      // an event this webhook already processed — expected on retries, not a
      // real failure, so it's not worth logging as one.
      if (insertError.code !== '23505') {
        console.error('Failed to record order line (continuing to attempt fulfillment regardless):', insertError);
      }
    }

    if (productType === 'digital') {
      // No physical shipment — mark delivered immediately.
      await updateOrder(admin, session.id, productId, { fulfillment_status: 'delivered' });
      await decrementVaultVariantInventoryIfApplicable(productId, quantity);
      await grantEntitlementIfApplicable(admin, productId, session.metadata?.supabase_user_id);
      continue;
    }

    if (productType === 'vault_shipment') {
      // A Vault-sourced physical original already exists as a real object —
      // there's no Printful/Gelato print-on-demand order to place. The seller
      // has to pack and ship it themselves; this just records that a real
      // sale happened and is waiting on that, with the shipping address
      // already captured in the insert above.
      await updateOrder(admin, session.id, productId, { fulfillment_status: 'awaiting_manual_fulfillment' });
      await decrementVaultVariantInventoryIfApplicable(productId, quantity);
      continue;
    }

    const product = findProduct(productId);
    if (!product) {
      await updateOrder(admin, session.id, productId, { fulfillment_status: 'unmapped' });
      continue;
    }

    if (productType === 'apparel') {
      if (!product.printfulVariantId || !shipping) {
        // No real Printful catalog variant mapped to this demo product (or no
        // shipping address collected) -- report honestly rather than guessing.
        await updateOrder(admin, session.id, productId, { fulfillment_provider: 'printful', fulfillment_status: 'unmapped' });
        continue;
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
              quantity,
              retail_price: (product.amount / 100).toFixed(2),
              // Real print artwork URL goes here once a real catalog exists.
              files: [],
            },
          ]
        );
        await updateOrder(admin, session.id, productId, {
          fulfillment_provider: 'printful',
          fulfillment_order_id: String(result.id),
          fulfillment_status: 'submitted',
        });
      } catch (err) {
        console.error('Printful order creation failed:', err);
        await updateOrder(admin, session.id, productId, { fulfillment_provider: 'printful', fulfillment_status: 'failed' });
      }
      continue;
    }

    if (productType === 'print_collateral') {
      if (!product.gelatoProductUid || !shipping) {
        await updateOrder(admin, session.id, productId, { fulfillment_provider: 'gelato', fulfillment_status: 'unmapped' });
        continue;
      }
      try {
        const [firstName, ...rest] = shipping.name.split(' ');
        const result = await createGelatoOrder(
          // One Gelato order per line item — needs its own unique reference
          // rather than the shared session id now that a session can carry
          // more than one print_collateral line.
          `${session.id}:${productId}`,
          [
            {
              itemReferenceId: product.id,
              productUid: product.gelatoProductUid,
              // Real print artwork URL goes here once a real catalog exists.
              files: [],
              quantity,
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
        await updateOrder(admin, session.id, productId, {
          fulfillment_provider: 'gelato',
          fulfillment_order_id: result.id,
          fulfillment_status: 'submitted',
        });
      } catch (err) {
        console.error('Gelato order creation failed:', err);
        await updateOrder(admin, session.id, productId, { fulfillment_provider: 'gelato', fulfillment_status: 'failed' });
      }
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
          await handleProductOrderCompleted(session, admin, stripe);
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
