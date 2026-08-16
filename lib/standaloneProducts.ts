// One-time-purchase products sold outside the subscription tiers in
// pricingPlans.ts — currently just Star Tracker. Mirrors that file's
// pattern (real Stripe Price ids, provisioned once via the Stripe API,
// looked up here rather than fetched at request time).
export interface StandaloneProduct {
  id: string;
  name: string;
  priceId: string;
  amountCents: number;
}

export const STANDALONE_PRODUCTS: StandaloneProduct[] = [
  {
    id: 'star-tracker',
    name: 'Star Tracker — Standalone',
    priceId: 'price_1U58FN6YqqBfIrutZGB5d5zD',
    amountCents: 6900,
  },
];

export function findStandaloneProductByPriceId(priceId: string): StandaloneProduct | undefined {
  return STANDALONE_PRODUCTS.find((p) => p.priceId === priceId);
}
