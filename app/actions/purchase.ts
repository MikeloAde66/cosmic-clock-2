'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { findProduct, type ProductType } from '@/lib/products';
import dbConnect from '@/lib/dbConnect';
import VaultProduct from '@/lib/models/VaultProduct';
import type { VaultDrawer } from '@/lib/vaultRegistry';

interface CheckoutItem {
  id: string;
  name: string;
  description: string;
  amount: number; // cents
  productType: ProductType;
}

// Vault-origin ids are "vault:<drawer>:<sku>" for a pack's single legacy
// listing, or "vault:<drawer>:<sku>:<variantId>" for one of its
// productVariants (see ProductsStorefront's merge of GET
// /api/vault/published into the catalog) — resolved against Mongo here
// rather than trusted from the form, and re-checked for
// isPublished/isAvailable so unpublishing a pack or a single variant takes
// it off the storefront immediately even if a stale page still has it in
// the DOM.
async function resolveCheckoutItem(productId: string): Promise<CheckoutItem | null> {
  if (productId.startsWith('vault:')) {
    const rest = productId.slice('vault:'.length);
    const sep = rest.indexOf(':');
    if (sep === -1 || !process.env.MONGODB_URI) return null;
    const drawer = rest.slice(0, sep);
    const skuAndMaybeVariant = rest.slice(sep + 1);

    await dbConnect();

    // Try "sku:variantId" first, falling back to treating the whole
    // remainder as a plain sku (the legacy single-listing form) if no
    // matching variant is found — keeps this correct even for a sku that
    // happens to contain its own colon.
    const lastSep = skuAndMaybeVariant.lastIndexOf(':');
    if (lastSep !== -1) {
      const sku = skuAndMaybeVariant.slice(0, lastSep);
      const variantId = skuAndMaybeVariant.slice(lastSep + 1);
      const doc = await VaultProduct.findOne({ sku, drawer: drawer as VaultDrawer });
      const variant = doc?.productVariants?.find((v) => v.id === variantId && v.isAvailable);
      if (doc && variant) {
        // A Vault-sourced physical original already exists as a real
        // object — it needs the seller to ship it themselves, not a
        // Printful/Gelato print-on-demand order (see 'vault_shipment' in
        // lib/products.ts). Everything else (digital_delivery,
        // license_grant) skips physical fulfillment like plain digital.
        const productType: ProductType = variant.fulfillmentType === 'shipment' ? 'vault_shipment' : 'digital';
        return {
          id: productId,
          name: variant.listingTitle,
          description: doc.description,
          amount: variant.priceCents,
          productType,
        };
      }
    }

    const doc = await VaultProduct.findOne({ sku: skuAndMaybeVariant, drawer: drawer as VaultDrawer, isPublished: true });
    if (!doc || !doc.priceCents) return null;
    return { id: productId, name: doc.title, description: doc.description, amount: doc.priceCents, productType: 'digital' };
  }

  const product = findProduct(productId);
  if (!product) return null;
  return { id: product.id, name: product.name, description: product.description, amount: product.amount, productType: product.productType };
}

export interface CartLineItem {
  productId: string;
  quantity: number;
}

export interface CartCheckoutState {
  error: string | null;
}

// One-time purchase, not a subscription — mode: 'payment' with inline
// price_data per cart line rather than pre-created Stripe Prices. Demo
// products have no real inventory, so there's nothing worth provisioning as
// a persistent Stripe object for those; Vault-origin products are real but
// still don't need a persistent Stripe Price since their own price can
// change per pack. Each line's product_data carries its own productId/
// product_type in metadata (rather than a single session-level metadata
// field) because a cart checkout can mix multiple products with different
// fulfillment paths in one Stripe session — the webhook reads it back per
// line via listLineItems to fulfill each item correctly.
//
// Takes (prevState, formData) rather than plain args so the calling
// component can drive it with useActionState — this Next version's own docs
// say to return validation failures from the action rather than throw a
// plain Error, and to call redirect() outside any try/catch, so failures
// (bad promo code, a since-unpublished item) come back as { error } for the
// Cart view to render, while success still falls through to a real redirect.
export async function createCartCheckout(_prevState: CartCheckoutState, formData: FormData): Promise<CartCheckoutState> {
  let items: CartLineItem[];
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { error: 'Cart data was corrupted — try refreshing the page.' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Your cart is empty.' };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'Stripe is not configured.' };
  }

  let resolved: (CheckoutItem & { quantity: number })[];
  try {
    resolved = await Promise.all(
      items.map(async (i) => {
        const item = await resolveCheckoutItem(i.productId);
        if (!item) throw new Error(`This item is no longer available: ${i.productId}`);
        return { ...item, quantity: Math.min(Math.max(1, Math.floor(i.quantity)), 99) };
      })
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'One of the items in your cart is no longer available.' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const headersList = await headers();
  const origin = headersList.get('origin') || `http://${headersList.get('host') ?? 'localhost:3000'}`;

  // Physical items need a real shipping address — for apparel/print_collateral
  // that's Printful/Gelato to ship to; for vault_shipment it's the seller,
  // fulfilling a one-of-a-kind original by hand. Digital-only carts skip
  // this collection step entirely.
  const isPhysical = resolved.some(
    (item) => item.productType === 'apparel' || item.productType === 'print_collateral' || item.productType === 'vault_shipment'
  );

  // A code typed into our own field is applied directly as a discount (and
  // validated up front, so a bad code fails loudly here instead of silently
  // at Stripe); Stripe's own promo field is also left on so a code can still
  // be entered on the hosted page for anyone who skips ours (e.g. arriving
  // straight from a QR code). The two are mutually exclusive per checkout
  // session, so only one is set. Applies once to the whole cart, not per item.
  const trimmedPromoCode = String(formData.get('promoCode') ?? '').trim();
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (trimmedPromoCode) {
    const matches = await stripe.promotionCodes.list({ code: trimmedPromoCode, active: true, limit: 1 });
    const promo = matches.data[0];
    if (!promo) {
      return { error: `Promo code "${trimmedPromoCode}" is invalid or expired.` };
    }
    discounts = [{ promotion_code: promo.id }];
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: resolved.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description,
          metadata: { productId: item.id, product_type: item.productType },
        },
        unit_amount: item.amount,
      },
      quantity: item.quantity,
    })),
    ...(isPhysical ? { shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU'] } } : {}),
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    success_url: `${origin}/?purchase=success`,
    cancel_url: `${origin}/?purchase=cancelled`,
    metadata: { cart: 'true', item_count: String(resolved.length) },
  });

  if (!session.url) {
    return { error: 'Stripe did not return a checkout URL.' };
  }
  redirect(session.url);
}
