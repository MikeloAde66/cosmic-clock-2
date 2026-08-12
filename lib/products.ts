// Demo catalog — no real inventory or product photography exists yet.
// Each entry is honestly marked `isDemo: true` in the UI rather than
// pretending these are real for-sale items. Swap in real products (and
// real images) here once there's an actual catalog; the storefront, cart
// actions, and checkout flow don't need to change.
export type ProductCategory = 'Apparel' | 'Art Prints' | 'Audio/Digital' | 'Vault Items';

export const PRODUCT_CATEGORIES: ProductCategory[] = ['Apparel', 'Art Prints', 'Audio/Digital', 'Vault Items'];

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  amount: number; // cents
  isDemo: true;
}

export const PRODUCTS: Product[] = [
  {
    id: 'apparel-cosmic-tee',
    name: 'Cosmic HUD Tee',
    category: 'Apparel',
    description: 'Minimal white-on-black print, cosmic clock motif.',
    amount: 2800,
    isDemo: true,
  },
  {
    id: 'apparel-kali-hoodie',
    name: 'Kali Yuga Hoodie',
    category: 'Apparel',
    description: 'Heavyweight fleece, embroidered epoch marker.',
    amount: 5800,
    isDemo: true,
  },
  {
    id: 'art-sacred-geometry',
    name: 'Sacred Geometry Print',
    category: 'Art Prints',
    description: '18x24 archival print, museum-grade paper.',
    amount: 4500,
    isDemo: true,
  },
  {
    id: 'art-flammarion',
    name: 'Flammarion Woodcut Print',
    category: 'Art Prints',
    description: 'Classic engraving, reproduced on matte fine art stock.',
    amount: 3800,
    isDemo: true,
  },
  {
    id: 'audio-432-meditation',
    name: '432Hz Meditation Pack',
    category: 'Audio/Digital',
    description: 'Digital download — 6 tuned ambient tracks.',
    amount: 1500,
    isDemo: true,
  },
  {
    id: 'audio-ambient-loop-kit',
    name: 'Cosmic Ambient Loop Kit',
    category: 'Audio/Digital',
    description: 'Digital download — royalty-free loop pack for producers.',
    amount: 2200,
    isDemo: true,
  },
  {
    id: 'vault-access-pass',
    name: 'Vault Access Pass',
    category: 'Vault Items',
    description: 'One-time unlock for a curated Vault drawer.',
    amount: 1200,
    isDemo: true,
  },
  {
    id: 'vault-founders-bundle',
    name: "Founder's Vault Bundle",
    category: 'Vault Items',
    description: 'Early-access bundle across multiple Vault drawers.',
    amount: 6000,
    isDemo: true,
  },
];

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
