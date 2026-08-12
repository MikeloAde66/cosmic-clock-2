// Real Stripe test-mode Products/Prices, provisioned once via the Stripe API
// (not hand-typed placeholders). To add/change a tier, create the Product +
// two recurring Prices in Stripe first, then update this list — nothing
// here calls Stripe at request time to look these up.
export interface PricingTier {
  id: string;
  name: string;
  description: string;
  features: string[];
  featured?: boolean;
  monthlyPriceId: string;
  monthlyAmount: number; // cents
  yearlyPriceId: string;
  yearlyAmount: number; // cents
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: 'hobby',
    name: 'Hobby',
    description: 'All the basics for starting a new project.',
    features: ['1 broadcast channel', 'Community support', 'Basic Vault storage'],
    monthlyPriceId: 'price_1U3cHF6YqqBfIrut7OdSX6a5',
    monthlyAmount: 1200,
    yearlyPriceId: 'price_1U3cHF6YqqBfIrutJvtBewQb',
    yearlyAmount: 12000,
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    description: 'For solo creators ready to grow.',
    features: ['5 broadcast channels', 'Priority support', 'Expanded Vault storage', 'Custom radio stations'],
    featured: true,
    monthlyPriceId: 'price_1U3cHF6YqqBfIrutfYyhnW8I',
    monthlyAmount: 2400,
    yearlyPriceId: 'price_1U3cHG6YqqBfIrutbGlDwxIl',
    yearlyAmount: 24000,
  },
  {
    id: 'startup',
    name: 'Startup',
    description: 'For small teams scaling their reach.',
    features: ['Unlimited broadcast channels', 'Priority support', 'Full Vault storage', 'n8n automation access'],
    monthlyPriceId: 'price_1U3cHG6YqqBfIrutGjtYm6YS',
    monthlyAmount: 3200,
    yearlyPriceId: 'price_1U3cHG6YqqBfIrutm926lax1',
    yearlyAmount: 32000,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations with advanced needs.',
    features: ['Everything in Startup', 'Dedicated support', 'Custom integrations', 'SLA guarantee'],
    monthlyPriceId: 'price_1U3cHH6YqqBfIrut3FQVAKLx',
    monthlyAmount: 4800,
    yearlyPriceId: 'price_1U3cHH6YqqBfIrutdKna3kFq',
    yearlyAmount: 48000,
  },
];

export function findTierByPriceId(priceId: string): PricingTier | undefined {
  return PRICING_TIERS.find((t) => t.monthlyPriceId === priceId || t.yearlyPriceId === priceId);
}
