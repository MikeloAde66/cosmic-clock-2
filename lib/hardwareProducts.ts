// Visual placeholders only — neither product has a real Stripe Price yet
// (unlike STANDALONE_PRODUCTS/PRICING_TIERS, which are always real,
// already-provisioned Stripe ids). Give each a real entry there once
// pricing/checkout is real — until then comingSoon keeps the CTA inert
// rather than pretending to charge anyone. coverImageSrc paths don't exist
// in public/ yet; HardwareProductSlide falls back to a placeholder icon
// until a real photo is dropped in at that path.
export interface HardwareProduct {
  id: string;
  badge: string;
  name: string;
  priceCents: number;
  coverImageSrc: string;
  headline: string;
  description: string;
  features: string[];
  featured?: boolean;
  comingSoon?: boolean;
}

export const HARDWARE_PRODUCTS: HardwareProduct[] = [
  {
    id: 'builder-kit',
    badge: 'Starter Edition · DIY Assembly',
    name: 'Builder Kit',
    priceCents: 29900,
    coverImageSrc: '/images/builder-kit.jpg',
    headline: 'Off-Grid Water Monitoring Systems Are Either Fragile Cloud Dependents or Messy Solder-It-Yourself Projects.',
    description:
      'The Builder Kit delivers pre-soldered, pre-flashed core hardware engineered for custom integration. Run quantized local classification models and encrypted SQLite logging directly on embedded hardware—100% offline with zero cloud dependency.',
    features: [
      'Pre-flashed 32GB Industrial MicroSD (Pre-loaded Offline OS & Dashboard)',
      'Pre-soldered Analog TDS Probe & Gravity Optical Turbidity Assembly',
      'ADS1115 16-Bit 4-Channel ADC Board & 4-Channel 12V Relay Module',
      'Native 12V DC Step-Down Buck Converter (< 5W Low-Draw Power)',
      'Comprehensive Assembly Guide & Custom Wiring Harness',
    ],
    comingSoon: true,
  },
  {
    id: 'hydronode-pro',
    badge: 'Popular · Turnkey Unit',
    name: 'HydroNode Pro',
    priceCents: 49900,
    coverImageSrc: '/images/hydronode-pro.jpg',
    headline: 'Commercial Filtration Systems Lack Real-Time Relay Automation and Require Continuous Internet Connectivity.',
    description:
      'HydroNode Pro is a fully bench-tested, turnkey node housed inside an IP65 weatherproof enclosure. It dynamically triggers 12V pumps, UV-C LED arrays, and diverter solenoids based on real-time neural water classification, serving live metrics over an offline local Wi-Fi Access Point.',
    features: [
      'Fully Assembled IP65 Weatherproof Junction Box with External Probe Glands',
      'Raspberry Pi 4 Model B Central Processor running Local Neural Algorithms',
      'Automated Multi-Stage Relay Control for Pumps, Solenoids, and UV-C LEDs',
      '100% Encrypted SQLite Database for Local Data Sovereignty',
      'Local Mesh Dashboard (Connect from any smartphone or browser offline)',
    ],
    featured: true,
    comingSoon: true,
  },
];
