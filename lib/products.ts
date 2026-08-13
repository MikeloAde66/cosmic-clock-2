// Demo catalog — no real inventory or product photography exists yet.
// Each entry is honestly marked `isDemo: true` in the UI rather than
// pretending these are real for-sale items. Swap in real products (and
// real images) here once there's an actual catalog; the storefront, cart
// actions, and checkout flow don't need to change.
export type ProductCategory = 'Apparel' | 'Art Prints' | 'Audio/Digital' | 'Vault Items';

export const PRODUCT_CATEGORIES: ProductCategory[] = ['Apparel', 'Art Prints', 'Audio/Digital', 'Vault Items'];

// Drives fulfillment routing (see app/api/webhooks/stripe/route.ts):
// apparel -> Printful, print_collateral -> Gelato, digital -> no physical
// shipment, vault_shipment -> no dropship API (a Vault-sourced physical
// original already exists as a real object; it needs the seller to pack
// and ship it themselves, not a print-on-demand order). Passed through as
// Stripe Checkout metadata at purchase time so the webhook doesn't need a
// second lookup.
export type ProductType = 'apparel' | 'print_collateral' | 'digital' | 'vault_shipment';

const CATEGORY_TO_PRODUCT_TYPE: Record<ProductCategory, ProductType> = {
  Apparel: 'apparel',
  'Art Prints': 'print_collateral',
  'Audio/Digital': 'digital',
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
}

function makeProduct(p: Omit<Product, 'productType' | 'isDemo'>): Product {
  return { ...p, productType: CATEGORY_TO_PRODUCT_TYPE[p.category], isDemo: true };
}

export const PRODUCTS: Product[] = [
  makeProduct({
    id: 'apparel-cosmic-tee',
    name: 'Cosmic HUD Tee',
    category: 'Apparel',
    description: 'Minimal white-on-black print, cosmic clock motif.',
    amount: 2800,
  }),
  makeProduct({
    id: 'apparel-kali-hoodie',
    name: 'Kali Yuga Hoodie',
    category: 'Apparel',
    description: 'Heavyweight fleece, embroidered epoch marker.',
    amount: 5800,
  }),
  makeProduct({
    id: 'art-sacred-geometry',
    name: 'Sacred Geometry Print',
    category: 'Art Prints',
    description: '18x24 archival print, museum-grade paper.',
    amount: 4500,
  }),
  makeProduct({
    id: 'art-flammarion',
    name: 'Flammarion Woodcut Print',
    category: 'Art Prints',
    description: 'Classic engraving, reproduced on matte fine art stock.',
    amount: 3800,
  }),
  makeProduct({
    id: 'audio-432-meditation',
    name: '432Hz Meditation Pack',
    category: 'Audio/Digital',
    description: 'Digital download — 6 tuned ambient tracks.',
    amount: 1500,
  }),
  makeProduct({
    id: 'audio-ambient-loop-kit',
    name: 'Cosmic Ambient Loop Kit',
    category: 'Audio/Digital',
    description: 'Digital download — royalty-free loop pack for producers.',
    amount: 2200,
  }),
  makeProduct({
    id: 'vault-access-pass',
    name: 'Vault Access Pass',
    category: 'Vault Items',
    description: 'One-time unlock for a curated Vault drawer.',
    amount: 1200,
  }),
  makeProduct({
    id: 'vault-founders-bundle',
    name: "Founder's Vault Bundle",
    category: 'Vault Items',
    description: 'Early-access bundle across multiple Vault drawers.',
    amount: 6000,
  }),
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
