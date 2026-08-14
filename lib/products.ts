// Demo catalog — no real inventory or product photography exists yet.
// Each entry is honestly marked `isDemo: true` in the UI rather than
// pretending these are real for-sale items. Swap in real products (and
// real images) here once there's an actual catalog; the storefront, cart
// actions, and checkout flow don't need to change.
export type ProductCategory = 'Apparel' | 'Survival Gear' | 'Vault Items';

export const PRODUCT_CATEGORIES: ProductCategory[] = ['Apparel', 'Survival Gear', 'Vault Items'];

// Drives fulfillment routing (see app/api/webhooks/stripe/route.ts):
// apparel -> Printful, print_collateral -> Gelato, digital -> no physical
// shipment, vault_shipment -> no dropship API (a Vault-sourced physical
// original already exists as a real object; it needs the seller to pack
// and ship it themselves, not a print-on-demand order). Passed through as
// Stripe Checkout metadata at purchase time so the webhook doesn't need a
// second lookup.
export type ProductType = 'apparel' | 'print_collateral' | 'digital' | 'vault_shipment';

// Survival Gear items (backpack, survival pack) are also Printful-fulfilled
// physical goods, so they route through the same 'apparel' ProductType the
// webhook already checks for — ProductType is a fulfillment-routing concept,
// not a 1:1 mirror of the UI category (Vault Items -> 'digital' is the same
// kind of deliberate mismatch).
const CATEGORY_TO_PRODUCT_TYPE: Record<ProductCategory, ProductType> = {
  Apparel: 'apparel',
  'Survival Gear': 'apparel',
  'Vault Items': 'digital',
};

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  productType: ProductType;
  description: string;
  amount: number; // cents
  isDemo: true;
  // Real Printful/Gelato catalogs use their own opaque per-variant ids —
  // none of these demo products map to anything real yet. Left undefined
  // until a real catalog SKU exists for a given item; the webhook checks
  // for this and reports "unmapped" rather than submitting a fulfillment
  // order with a fabricated id.
  printfulVariantId?: number;
  gelatoProductUid?: string;
  // Real mockup/photography URLs, when they exist — still isDemo (no
  // fulfillment mapping yet) even once a product has real images; those are
  // two separate things. Only the first is shown on the storefront card
  // (a flat grid, not a per-product detail page with a gallery). Left
  // undefined until real photography exists — the storefront falls back to
  // a category icon rather than a fake placeholder image.
  imageUrls?: string[];
}

function makeProduct(p: Omit<Product, 'productType' | 'isDemo'>): Product {
  return { ...p, productType: CATEGORY_TO_PRODUCT_TYPE[p.category], isDemo: true };
}

export const PRODUCTS: Product[] = [
  makeProduct({
    id: 'apparel-kali-hoodie',
    name: 'Kali Hoodie',
    category: 'Apparel',
    description: 'Heavyweight fleece, embroidered epoch marker. Printful fulfilled.',
    amount: 5800,
  }),
  makeProduct({
    id: 'apparel-kali-tee',
    name: 'Kali Tee Shirt',
    category: 'Apparel',
    description: 'Minimal white-on-black print, cosmic clock motif. Printful fulfilled.',
    amount: 2800,
  }),
  makeProduct({
    id: 'apparel-kali-jersey',
    name: 'Kali Jersey',
    category: 'Apparel',
    description: 'Athletic-cut jersey, epoch numerals on the sleeve. Printful fulfilled.',
    amount: 4200,
  }),
  makeProduct({
    id: 'apparel-kali-hat',
    name: 'Kali Hat',
    category: 'Apparel',
    description: 'Structured cap, embroidered mark. Printful fulfilled.',
    amount: 2400,
  }),
  makeProduct({
    id: 'gear-backpack',
    name: 'Backpack',
    category: 'Survival Gear',
    description: 'Everyday-carry pack built for the field. Printful fulfilled.',
    amount: 6500,
  }),
  makeProduct({
    id: 'gear-kali-survival-pack',
    name: 'Kali Survival Pack',
    category: 'Survival Gear',
    description: 'Bundled survival kit — Printful fulfilled, multiple items shipped together.',
    amount: 8900,
  }),
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
